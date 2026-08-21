const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const fontPath = path.join(__dirname, '..', 'fonts', 'arial.ttf');
const fontBuf = fs.readFileSync(fontPath);

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
  <rect width="600" height="200" fill="#000000"/>
  <text x="30" y="80" font-family="Arial" font-size="32" font-weight="bold" fill="#D4FF00">GYM BUDDY AI</text>
  <text x="30" y="140" font-family="Arial" font-size="24" fill="#FFFFFF">785 kcal - Protein 38g</text>
</svg>
`;

const resvg = new Resvg(svg, {
  font: {
    fontBuffers: [fontBuf],
    defaultFontFamily: 'Arial'
  }
});

const png = resvg.render().asPng();
fs.writeFileSync('test_font_render.png', png);
console.log('FONT RENDER SUCCESSFUL! PNG SIZE:', png.length);
