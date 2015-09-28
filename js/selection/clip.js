/**
  @copyright 2014-2015 Nesterovsky bros.
  @module clip
  
  @description Module defines a directive svg-clip that is used to 
    display a single selection.

  svg-clip directive uses template defined in clip.html.
*/
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

    /**
      @ngdoc directive
      @name svgClip
      @restrict A
      @description A selection directive.
      @scope
      @param {expression} imageSrc A source url of the image.
      @param {expression} [selected] A selected indicator.
      @param {expression} svgClip A clip path.
     */
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
