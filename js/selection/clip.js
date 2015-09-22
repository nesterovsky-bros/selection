define(
  [
    "./module",
    "angular",
    "text!./clip.html!strip",
    "./selectionTool"
  ],
  function(module, angular, template, SelectionTool)
  {
    "use strict";

    module.directive(
      "svgClip",
      [
        "$location",
        function($location)
        {
          var definition = 
          {
            restrict: "A",
            scope:
            {
              imageSrc: "=",
              selected: "=?",
              svgClip: "=" // a clip path
            },
            template: template,
            link: function(scope, element, attrs)
            {
              var path = $location.absUrl();
              var p = path.lastIndexOf("#");

              scope.path =  p === -1 ? path : path.substring(0, p);

              scope.$watch(
                function() { return scope.svgClip; },
                function(path) { scope.bounds = SelectionTool.getBBox(path); });

              scope.$watch(
                function() { return scope.imageSrc; },
                function(url)
                {
                  SelectionTool.getImageSize(url, function(size)
                  {
                    scope.width = size.width;
                    scope.height = size.height;
                    scope.$apply();
                  });
                });
            }
          };

          return definition;
        }
      ]);

    return module;
  });
