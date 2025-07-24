import { processSampleData } from "./scripts/utils.js";

const dataStyle = (dataStyleF, noDataStyle) => (feature) =>
  feature.data
    ? typeof dataStyleF === "function"
      ? dataStyleF(feature.data)
      : dataStyleF
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
      getActiveGeojson,
      getActiveData,
      GLOBAL_SELECTED_DISTRICT_INFO,
      duration
    );
  };
})();

const renderMap = (
  svgNode,
  tooltip,
  projection,
  getGeojson,
  getData,
  selectedDistrictInfoObj,
  duration
) => {
  const defaultDuration = 200;
  const selectedDistrictInfo = selectedDistrictInfoObj || {
    district: null,
    subDistrict: null,
  };

  const selectedStyle = selectedStyleF(selectedDistrictInfo);

  const geojson = getGeojson();
  const data = getData();

  // Attach the relevant data to each feature for easy access in event handlers
  const featuresWithData = geojson.features.map((feature) => ({
    ...feature,
    data: feature.properties.NAME_2
      ? data[feature.properties.NAME_2]
      : data[feature.properties.NAME_1],
  }));

  // Bind the combined data to paths
  const path = svgNode.selectAll("path").data(featuresWithData);

  function mouseover(event, d) {
    console.log("mouseover triggered", {
      district: d.properties.NAME_1,
      subDistrict: d.properties.NAME_2,
      hasData: !!d.data,
    });

    const sampleData = d.data;
    if (!sampleData) {
      console.log("no sample data", d.properties.NAME_1, d.properties.NAME_2);
      return;
    }

    console.log("hover render map", {
      properties: d.properties,
      data: d.data,
    });

    selectedDistrictInfoObj.district = d.properties.NAME_1;
    selectedDistrictInfoObj.subDistrict = d.properties.NAME_2;

    tooltip
      .style("z-index", "1000")
      .transition()
      .duration(200)
      .style("opacity", 1);
    tooltip
      .html(
        renderTooltipHTML(
          d.properties.NAME_1,
          d.properties.NAME_2,
          sampleData["Fluência"]
        )
      )
      .style("left", event.pageX + "px")
      .style("top", event.pageY + "px");

    // Reset all paths to default style first
    svgNode
      .selectAll("path")
      .attr("stroke-width", "1px")
      .attr("stroke", "#000")
      .on("mouseover", mouseover)
      .on("mouseout", mouseout);

    // Then set the hovered path style
    d3.select(this)
      .attr("stroke-width", "2px")
      .attr("stroke", "#FFF")
      .on("mouseover", mouseover)
      .on("mouseout", mouseout);
  }

  function mouseout(event, d) {
    console.log("mouseout triggered", {
      district: d.properties.NAME_1,
      subDistrict: d.properties.NAME_2,
      hasData: !!d.data,
      currentSelected: {
        district: selectedDistrictInfoObj.district,
        subDistrict: selectedDistrictInfoObj.subDistrict,
      },
    });

    // Only clear the selection if we're leaving the currently selected district
    if (
      selectedDistrictInfoObj.district === d.properties.NAME_1 &&
      (!selectedDistrictInfoObj.subDistrict ||
        selectedDistrictInfoObj.subDistrict === d.properties.NAME_2)
    ) {
      console.log("clearing selection");
      selectedDistrictInfoObj.district = null;
      selectedDistrictInfoObj.subDistrict = null;

      tooltip
        .transition()
        .duration(200)
        .style("opacity", 0)
        .on("end", () => {
          console.log("animation ended, tooltip opacity 0");
          tooltip.style("z-index", "-1");
        });

      d3.select(this)
        .attr("stroke-width", "1px")
        .attr("stroke", "#000")
        .on("mouseover", mouseover)
        .on("mouseout", mouseout);
    }
  }

  // Enter selection: create new paths and set up event listeners and styles
  const enterPaths = path
    .enter()
    .append("path")
    .attr("d", d3.geoPath().projection(projection))
    .attr("stroke-width", "1px")
    .attr("stroke", "#000")
    .attr("fill", dataStyle("#F2B02A", "#ccc"))
    .on("mouseover", mouseover)
    .on("mouseout", mouseout);

  // Update selection: update the path data if the geojson changes
  path
    .merge(enterPaths)
    .transition()
    .duration(
      duration === null || duration === undefined ? defaultDuration : duration
    )
    .attr("d", d3.geoPath().projection(projection));
  // No need to re-apply styles or event listeners here, unless you want to animate color changes

  path.exit().remove();
};

const renderTooltipHTML = (districtName, subDistrictName, data) => {
  const subDistrictHTML = !subDistrictName ? "" : `, ${subDistrictName}`;
  const titleHTML = `<span>${districtName}${subDistrictHTML}</span>`;
  const total = Object.values(data).reduce((accum, value) => accum + value, 0);
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
                    (dataKey) => `<div class="cell">${translate(dataKey)}</div>`
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
      for (const [subDistrictName, subDistrictProperties] of Object.entries(
        districtObj
      )) {
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
window.GLOBAL_DATA = {};
const getActiveData = () => {
  console.log("get active data", ACTIVE_KEY_DATA, GLOBAL_DATA[ACTIVE_KEY_DATA]);
  return ACTIVE_KEY_DATA && GLOBAL_DATA[ACTIVE_KEY_DATA];
};

window.GLOBAL_GEOJSON = {};
const getActiveGeojson = () => {
  console.log(
    "get active geojson",
    ACTIVE_KEY_GEOJSON,
    GLOBAL_GEOJSON[ACTIVE_KEY_GEOJSON]
  );
  return ACTIVE_KEY_GEOJSON && GLOBAL_GEOJSON[ACTIVE_KEY_GEOJSON];
};

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
      ACTIVE_KEY_DATA = element.getAttribute("data-key");
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
        const bySubDistrict = processSampleData(parsedData, "DS", ["Fluência"]);
        GLOBAL_DATA.byDistrict = byDistrict;
        GLOBAL_DATA.bySubDistrict = bySubDistrict;
        console.log({ byDistrict, bySubDistrict });

        return { byDistrict, bySubDistrict };
      }),

    fetch("./geojson/gadm41_LKA_1.json")
      .then((response) => response.json())
      .then((districtGeoJSON) => {
        GLOBAL_GEOJSON.byDistrict = districtGeoJSON;
        return districtGeoJSON;
      }),

    fetch("./geojson/gadm41_LKA_2.json")
      .then((response) => response.json())
      .then((subdistrictGeoJSON) => {
        GLOBAL_GEOJSON.bySubDistrict = subdistrictGeoJSON;
        return subdistrictGeoJSON;
      }),
  ]).then(
    ([{ byDistrict, bySubDistrict }, districtGeoJSON, subdistrictGeoJSON]) => {
      updateMap();
    }
  );
};

document.onreadystatechange = () => {
  if (document.readyState === "complete") {
    main();
  }
};

document.onload = () => {
  main();
};
