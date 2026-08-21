const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
  <rect width="400" height="100" fill="#000000"/>
  <text x="20" y="60" font-family="sans-serif" font-weight="bold" font-size="32" fill="#D4FF00">GYM BUDDY AI</text>
</svg>
`;

const resvg = new Resvg(svg, {
  font: {
    loadSystemFonts: true
  }
});
const pngData = resvg.render().asPng();
console.log("PNG GENERATED, SIZE:", pngData.length);
fs.writeFileSync('test_out.png', pngData);
