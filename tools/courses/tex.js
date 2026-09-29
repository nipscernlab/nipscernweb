/* As fórmulas dos roteiros, desenhadas pelo KaTeX na hora do build.
   ------------------------------------------------------------------
   Chamado por tools/courses/build.py, que manda pela entrada padrão uma lista
   JSON de {tex, display} e lê de volta, na mesma ordem, o HTML de cada uma.
   A página publicada não roda KaTeX nenhum: leva o HTML pronto, a folha
   assets/css/vendor/katex.min.css e as fontes dela. Fórmula que o KaTeX não
   entende é erro, e o build para dizendo qual foi, em vez de publicar o LaTeX
   cru no meio do texto. */
const katex = require('katex');

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { entrada += c; });
process.stdin.on('end', () => {
  const pedidos = JSON.parse(entrada);
  const saida = pedidos.map(({ tex, display }) => {
    try {
      return katex.renderToString(tex, { displayMode: !!display, throwOnError: true, strict: 'error', output: 'htmlAndMathml' });
    } catch (e) {
      process.stderr.write('KaTeX não desenhou ' + JSON.stringify(tex) + ': ' + e.message + '\n');
      process.exit(1);
    }
  });
  process.stdout.write(JSON.stringify(saida));
});
