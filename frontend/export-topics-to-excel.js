import XLSX from 'xlsx';
import { mathTopicsData } from './src/components/topicData.js';

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Helper function to flatten topic data into rows
function createSheetData(topics, level) {
  const rows = [];

  // Add header row
  rows.push(['Level', 'Topic Label', 'Hashtag', 'Sub-Hashtags', 'Description']);

  // Add data rows
  topics.forEach(topic => {
    rows.push([
      level,
      topic.label,
      topic.hashtag,
      topic.subHashtags.join(', '),
      topic.description
    ]);
  });

  return rows;
}

// Process each level
const levels = [
  { key: 'mathSec1', name: 'Math Sec 1' },
  { key: 'mathSec2', name: 'Math Sec 2' },
  { key: 'mathSec3', name: 'Math Sec 3' },
  { key: 'mathSec4', name: 'Math Sec 4' },
  { key: 'amathSec3', name: 'A-Math Sec 3' },
  { key: 'amathSec4', name: 'A-Math Sec 4' },
];

// Create separate sheets for each level
levels.forEach(level => {
  const data = mathTopicsData[level.key];
  if (data) {
    const sheetData = createSheetData(data, level.name);
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 },  // Level
      { wch: 30 },  // Topic Label
      { wch: 20 },  // Hashtag
      { wch: 50 },  // Sub-Hashtags
      { wch: 80 }   // Description
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, level.name);
  }
});

// Create a combined "All Topics" sheet
const allRows = [['Level', 'Topic Label', 'Hashtag', 'Sub-Hashtags', 'Description']];

levels.forEach(level => {
  const data = mathTopicsData[level.key];
  if (data) {
    data.forEach(topic => {
      allRows.push([
        level.name,
        topic.label,
        topic.hashtag,
        topic.subHashtags.join(', '),
        topic.description
      ]);
    });
  }
});

const allWorksheet = XLSX.utils.aoa_to_sheet(allRows);
allWorksheet['!cols'] = [
  { wch: 15 },  // Level
  { wch: 30 },  // Topic Label
  { wch: 20 },  // Hashtag
  { wch: 50 },  // Sub-Hashtags
  { wch: 80 }   // Description
];

// Insert "All Topics" sheet at the beginning
XLSX.utils.book_append_sheet(workbook, allWorksheet, 'All Topics');

// Write to file
const outputPath = './topic-data-export.xlsx';
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Excel file exported successfully to: ${outputPath}`);
console.log(`📊 Total sheets: ${levels.length + 1} (${levels.length} individual levels + 1 combined)`);
console.log(`📝 Total topics: ${allRows.length - 1}`);
