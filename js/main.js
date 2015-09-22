require(
{
  paths:
  {
    angular: "https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.4.6/angular",
    text: "https://cdnjs.cloudflare.com/ajax/libs/require-text/2.0.12/text"
  },

  shim:
  {
    angular: { exports: "angular" },
  }
});

require(
  [
    "angular",
    "selection/module",
    "selection/selection",
    "selection/clip"
  ],
  function(angular, module)
  {
    return angular.bootstrap(document, ["selection"]);
  });
  