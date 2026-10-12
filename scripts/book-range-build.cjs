'use strict';
const fs = require('node:fs');
const path = require('node:path');
const STYLE = '<style id="ym-book-range-style">.range-fields>[hidden],.ym-custom-range[hidden],#ymImportedSets[hidden],#ymEditSelectedBook[hidden]{display:none!important}.ym-custom-range{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0}.ym-custom-range input{box-sizing:border-box;width:100%;min-width:0;margin-top:4px;padding:8px;border:1px solid #555;border-radius:9px;background:#292929;color:#fff;min-height:40px;font:inherit;font-size:16px}.ym-custom-range input[aria-invalid="true"]{border-color:#f99}#ymBookSelect,#ymStudyRangeSelect{min-width:0;max-width:100%}.range-fields>.mode-field{min-width:0}.quiz-container:has(#ymBookSelect) #ymEditSelectedBook{margin:8px 6px 0 0;font-size:13px;min-height:40px;padding:8px 12px}@media(max-width:420px){.quiz-container:has(#ymBookSelect) .range-fields{grid-template-columns:1fr}}</style>';
function applyBookRange(page) {
 if (typeof page !== 'string' || !page.includes('id="ym-document-study-import"') || !page.includes('</body>')) throw Error('Book/range upgrade requires the document-import module and a complete page.');
 if (page.includes('id="ym-book-range-script"')) return page;
 const source = fs.readFileSync(path.join(__dirname,'book-range.js'),'utf8');
 if (/<\/script/i.test(source)) throw Error('Unsafe inline book/range script.');
 return page.replace('</body>', STYLE + '\n<script id="ym-book-range-script">\n' + source + '\n</script>\n</body>');
}
module.exports = {applyBookRange};
