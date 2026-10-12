'use strict';
const fs = require('node:fs');
const path = require('node:path');
const STYLE = '<style id="ym-book-trash-style">#ymTrashSelectedBook[hidden]{display:none!important}.ym-deleted-book{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:8px 0}.ym-deleted-book span{overflow-wrap:anywhere;min-width:0}.quiz-container:has(#ymBookSelect) #ymTrashSelectedBook{margin:8px 6px 0 0;font-size:13px;min-height:40px;padding:8px 12px}</style>';
function applyBookTrash(page) {
 if (typeof page !== 'string' || !page.includes('id="ym-book-range-script"') || !page.includes('</body>')) throw Error('Book trash requires the book/range module and a complete page.');
 if (page.includes('id="ym-book-trash-script"')) return page;
 const source = fs.readFileSync(path.join(__dirname,'book-trash.js'),'utf8');
 if (/<\/script/i.test(source)) throw Error('Unsafe inline book trash script.');
 return page.replace('</body>',STYLE + '\n<script id="ym-book-trash-script">\n' + source + '\n</script>\n</body>');
}
module.exports = {applyBookTrash};
