module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // laravel-echo (dist/echo.js) usa "static {}" (class static blocks,
    // ES2022), que o Hermes não suporta nativamente e babel-preset-expo não
    // transforma por padrão — sem isso o bundle inteiro falha ao compilar.
    // (Não adicionamos os plugins de private-methods/private-property, já
    // presentes em devDependencies mas nunca ligados aqui: habilitá-los sem
    // casar o "loose mode" com o @babel/plugin-transform-class-properties já
    // usado internamente pelo babel-preset-expo quebra o build do próprio
    // expo-router — nada no projeto precisa deles hoje.)
    plugins: ['@babel/plugin-transform-class-static-block'],
  };
};