/**
 * @param {*} sampleData - The data to process
 * @param {*} columnToGroupBy - The column to group by
 * @param {*} columnsToCount - The columns to count
 * @returns - The grouped data
 *
 * Takes list of sample data. Each sample is an object with columns.
 * Groups the data by the columnToGroupBy column.
 * Counts the number of times each value appears in the columnsToCount columns.
 * Returns the grouped data.
 *
 * Example:
 *
 * processSampleData(sampleData, 'gender', ['city'])
 *
 * where sampleData is:
 * [
 *   { gender: 'male', city: 'New York' },
 *   { gender: 'female', city: 'New York' },
 *   { gender: 'male', city: 'Los Angeles' },
 *   { gender: 'female', city: 'Los Angeles' },
 *   { gender: 'male', city: 'Chicago' },
 *   { gender: 'female', city: 'Chicago' },
 * ]
 *
 * The result will be:
 * {
 *   Male: { CTY: { NYC: 1, LA: 1, Chi: 1 } },
 *   Female: { CTY: { NYC: 1, LA: 1, Chi: 1 } },
 * }
 */

export const processSampleData = (
  sampleData,
  columnToGroupBy,
  columnsToCount
) => {
  const groupedData = {};

  for (const item of sampleData) {
    // Get the group for the current item
    const itemGroup = groupedData[item[columnToGroupBy]] || {};
    for (const column of columnsToCount) {
      // Count the number of times each value appears in the column
      const columnValueCounters = itemGroup[column] || {};
      columnValueCounters[item[column]] =
        (columnValueCounters[item[column]] || 0) + 1;
      itemGroup[column] = columnValueCounters;
    }
    groupedData[item[columnToGroupBy]] = itemGroup;
  }
  return groupedData;
};
