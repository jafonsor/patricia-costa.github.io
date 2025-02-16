import { processSampleData } from "./scripts/utils.js";

const dataStyleF = (data) => (dataStyle, noDataStyle) => (feature) =>
    data?.[feature.properties.NAME_1] || data?.[feature.properties.NAME_2]
        ? typeof dataStyle === "function"
            ? dataStyle(data)
            : dataStyle
        : noDataStyle;

const selectedStyleF =
    (selectedDistrictInfo) => (selected, notSelected) => (feature) =>
        selectedDistrictInfo &&
        feature.properties.NAME_1 === selectedDistrictInfo.district &&
        (!selectedDistrictInfo.subDistrict ||
            feature.properties.NAME_2 === selectedDistrictInfo.subDistrict)
            ? selected
            : notSelected;

const updateMap = (() => {
    const svgNode = d3
        .select("#map-container")
        .append("svg")
        .attr("width", 500)
        .attr("height", 650);

    const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const projection = d3.geoMercator().scale(8000).center([82.5, 8.5]);

    const GLOBAL_SELECTED_DISTRICT_INFO = {
        district: null,
        subDistrict: null,
    };

    return (duration) => {
        renderMap(
            svgNode,
            tooltip,
            projection,
            getActiveGeojson(),
            getActiveData(),
            GLOBAL_SELECTED_DISTRICT_INFO,
            duration
        );
    };
})();

const renderMap = (
    svgNode,
    tooltip,
    projection,
    geojson,
    data,
    selectedDistrictInfoObj,
    duration
) => {
    const defaultDuration = 200;
    const selectedDistrictInfo = selectedDistrictInfoObj || {
        district: null,
        subDistrict: null,
    };

    const dataStyle = dataStyleF(data);
    const selectedStyle = selectedStyleF(selectedDistrictInfo);

    const path = svgNode.selectAll("path").data(geojson.features);

    // Add paths for each feature in the GeoJSON
    path.enter()
        .append("path")
        .attr("d", d3.geoPath().projection(projection))
        .attr("stroke", selectedStyle("#FFF", "#000"))
        .attr("stroke-width", "1px")
        .attr("fill", dataStyle("#F2B02A", "#ccc"))
        // hover events
        .on("mouseover", (event, d) => {
            // get the sample data for the feature. looks for subdistrict name, otherwise
            // uses district name. if no data is found for both, then it does not open the tooltip
            const districtData = data?.[d.properties.NAME_1];
            const subDistrictData = data?.[d.properties.NAME_2];

            const sampleData = districtData || subDistrictData;
            if (data && !sampleData) {
                return;
            }

            selectedDistrictInfoObj.district = d.properties.NAME_1;
            selectedDistrictInfoObj.subDistrict = d.properties.NAME_2;

            tooltip.transition().duration(200).style("opacity", 1);
            tooltip
                .html(
                    data
                        ? renderTooltipHTML(
                              d.properties.NAME_1,
                              d.properties.NAME_2,
                              sampleData?.["Fluência"]
                          )
                        : renderEmptyTooltipHTML()
                )
                .style("left", event.pageX + "px")
                .style("top", event.pageY + "px");

            updateMap();
            console.log("hover render map", d.properties);
        });

    path.transition()
        .duration(
            duration === null || duration === undefined
                ? defaultDuration
                : duration
        )
        .attr("d", d3.geoPath().projection(projection))
        .attr("stroke", selectedStyle("#FFF", "#000"))
        .attr("fill", dataStyle("#F2B02A", "#ccc"))
        .attr("stroke-width", selectedStyle("2px", "1px"));

    path.exit().remove();
};

const renderTooltipHTML = (districtName, subDistrictName, data) => {
    const subDistrictHTML = !subDistrictName ? "" : `, ${subDistrictName}`;
    const titleHTML = `<span>${districtName}${subDistrictHTML}</span>`;
    const total = Object.values(data).reduce(
        (accum, value) => accum + value,
        0
    );
    const totalHTML = `<div class="sampled"><span>${total} sampled</span></div>`;
    const headerHTML = `<div class="tooltip-header">${titleHTML}${totalHTML}</div>`;

    const dataKeys = ["Falantes", "Semi-falantes", "Não-falantes", "NA"];
    const translate = (ptText) => {
        const translation = {
            Falantes: "Speakers",
            "Semi-falantes": "Semi-speakers",
            "Não-falantes": "Non-speakers",
            NA: "NA",
        };
        return translation[ptText] || ptText;
    };

    // organize the table by columns to make the columns evenly spaced
    const tableHTML = `
        <div class="table">
            <div class="column table-header">
                ${dataKeys
                    .map(
                        (dataKey) =>
                            `<div class="cell">${translate(dataKey)}</div>`
                    )
                    .join("\n")}

            </div>

            <div class="column">
                ${dataKeys
                    .map(
                        (dataKey) =>
                            `<div class="cell num"> ${data[dataKey] || 0}</div>`
                    )
                    .join("\n")}
            </div>

            <div class="column">
                ${dataKeys
                    .map(
                        (dataKey) =>
                            `<div class="cell num">${
                                data[dataKey]
                                    ? Math.round((data[dataKey] / total) * 100)
                                    : 0
                            }%</div>`
                    )
                    .join("\n")}
            </div>
        </div>`;

    return `${headerHTML}${tableHTML}`;
};

const renderEmptyTooltipHTML = () =>
    '<div class="table"><h2>Loading data...</h2></div>';

const setPath = (obj, path, value) => {
    if (!path || path.length === 0) {
        throw "empty path";
    }

    if (!obj) {
        throw "no object";
    }

    if (path.length === 1) {
        obj[path[0]] = value;
    } else {
        const [p, ...restPath] = path;
        if (!obj[p]) {
            obj[p] = {};
        }
        setPath(obj[p], restPath, value);
    }
};

const renderTestMenu = (geojson, updateMap) => {
    console.log("geo json", geojson);

    const featuresByDistrict = {};
    for (const feature of geojson.features) {
        const properties = feature.properties;
        setPath(
            featuresByDistrict,
            [
                properties.NAME_1,
                ...((properties.NAME_2 && [properties.NAME_2]) || []),
            ],
            properties
        );
    }

    const selectedDistrictInfo = {
        district: null,
        subDistrict: null,
    };
    const menuDiv = document.getElementById("menu");
    for (const [districtName, districtObj] of Object.entries(
        featuresByDistrict
    )) {
        let districtDiv = document.createElement("div");
        menuDiv.appendChild(districtDiv);
        const districtTitle = document.createElement("span");
        districtDiv.appendChild(districtTitle);
        districtTitle.textContent = districtName;
        districtTitle.addEventListener("mouseenter", () => {
            selectedDistrictInfo.district = districtName;
            selectedDistrictInfo.subDistrict = null;
            updateMap(selectedDistrictInfo);
        });
        const districtList = document.createElement("ol");
        districtDiv.appendChild(districtList);

        // check if districtObj is properties or a map of districts. for this we check if it has one of the fields of properties
        if (!districtObj.NAME_1) {
            for (const [
                subDistrictName,
                subDistrictProperties,
            ] of Object.entries(districtObj)) {
                const subDistrictDiv = document.createElement("li");
                districtList.appendChild(subDistrictDiv);

                const subDistrictNameSpan = document.createElement("span");
                subDistrictDiv.appendChild(subDistrictNameSpan);
                subDistrictNameSpan.textContent = subDistrictName;
                subDistrictNameSpan.addEventListener("mouseenter", () => {
                    selectedDistrictInfo.district = districtName;
                    selectedDistrictInfo.subDistrict = subDistrictName;
                    updateMap(selectedDistrictInfo);
                });
            }
        }
    }
};

let ACTIVE_KEY_DATA = "bySubDistrict";
let ACTIVE_KEY_GEOJSON = "bySubDistrict";

// this will be used to store the sample data on load and make it accessible on the map
const GLOBAL_DATA = {};
const getActiveData = () => ACTIVE_KEY_DATA && GLOBAL_DATA[ACTIVE_KEY_DATA];

const GLOBAL_GEOJSON = {};
const getActiveGeojson = () =>
    ACTIVE_KEY_GEOJSON && GLOBAL_GEOJSON[ACTIVE_KEY_GEOJSON];

const setupView = (geojson) => {
    const svgNode = d3
        .select("#map-container")
        .append("svg")
        .attr("width", 500)
        .attr("height", 650);

    const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const projection = d3.geoMercator().scale(8000).center([82.5, 8.5]);

    renderMap(svgNode, geojson, projection, tooltip, getActiveData);
    // renderTestMenu(geojson, updateMap(svgNode, geojson, projection, tooltip));)
};

// https://brendansudol.github.io/writing/responsive-d3

const main = async () => {
    const MAP_ELEMENT_ID = "#map";

    //fetch("./geojson/gadm41_LKA_1.json") // district map

    document.querySelectorAll("[geojson-key]").forEach((element) => {
        element.addEventListener("click", () => {
            ACTIVE_KEY_GEOJSON = element.getAttribute("geojson-key");
            ACTIVE_KEY_GEOJSON = element.getAttribute("data-key");
            document
                .querySelectorAll(".map .button-container .button.selected")
                .forEach((selected) => {
                    selected.classList.remove("selected");
                    selected.classList.add("unselected");
                });
            element.classList.remove("unselected");
            element.classList.add("selected");
            updateMap(0);
        });
    });

    Promise.all([
        fetch("./data/df1.csv")
            .then((response) => response.text())
            .then((text) => {
                const data = XLSX.read(text, { type: "string" });
                const sheet = data.Sheets[data.SheetNames[0]];
                const parsedData = XLSX.utils.sheet_to_json(sheet, {
                    raw: true,
                });
                const byDistrict = processSampleData(parsedData, "Localidade", [
                    "Fluência",
                ]);
                const bySubDistrict = processSampleData(parsedData, "Zona", [
                    "Fluência",
                ]);
                GLOBAL_DATA.byDistrict = byDistrict;
                GLOBAL_DATA.bySubDistrict = bySubDistrict;
                console.log({ byDistrict, bySubDistrict });
            }),

        fetch("./geojson/gadm41_LKA_1.json")
            .then((response) => response.json())
            .then((districtGeoJSON) => {
                GLOBAL_GEOJSON.byDistrict = districtGeoJSON;
            }),

        fetch("./geojson/gadm41_LKA_2.json")
            .then((response) => response.json())
            .then((subdistrictGeoJSON) => {
                GLOBAL_GEOJSON.bySubDistrict = subdistrictGeoJSON;
            }),
    ]).then(() => {
        updateMap();
    });
};

document.onreadystatechange = () => {
    if (document.readyState === "complete") {
        main();
    }
};

document.onload = () => {
    main();
};
