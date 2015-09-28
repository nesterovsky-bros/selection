/**
  @copyright 2014-2015 Nesterovsky bros.
  @module selection 
  
  @description This module is angularjs wrapper arround {@link module:selectionTool}.

  Module defines a directive svg-selection.
  svg-selection directive uses template defined in selection.html.
*/
define(
  [
    "./module",
    "angular",
    "text!./selection.html!strip",
    "./selectionTool"
  ],
  function(module, angular, template, SelectionTool)
  {
    "use strict";

    /**
      @ngdoc directive
      @name svgSelection
      @restrict A
      @description A selection directive.
      @scope
      @param {expression} imageSrc A source url of the image.
      @param {expression} [readonly=false] A boolean readonly indicator.
      @param {expression} svgSelection An array of selections.
      @param {string} svgSelection.path A SVG path.
      @param {boolean} [svgSelection.selected = false] 
        A path selection indicator.
     */
    module.directive(
      "svgSelection",
      function()
      {
        var definition = 
        {
          restrict: "A",
          scope:
          {
            imageSrc: "=",
            readonly: "=",

            // array or objects { path: string, selected: boolean }
            svgSelection: "=" 
          },
          template: template,
          link: function(scope, element, attrs)
          {
            var root = null;
            var size = null;
            var cancelLoading = angular.noop;
            var cancelChange = angular.noop;
            var updating = 0;
              
            scope.$on('$destroy', function()
            {
              size = null;
              cancelChange();
              cancelLoading();

              if (root)
              {
                root.release();
                root = null;
              }
            });

            root = new SelectionTool.Root(element[0]);
            cancelChange = SelectionTool.on(root, "change", updateSelection);

            scope.$watch(function() { return scope.imageSrc; }, loadImage);
            scope.$watch(
              function() { return scope.readonly; }, 
              function(value) { root.readonly = value; });

            scope.$watch(
              function() { return scope.svgSelection; },
              updateRoot,
              true);

            attrs.$addClass(SelectionTool.classFor("container"));

            var tabindex = element.attr("tabindex");

            if ((tabindex == null) || (tabindex < 0))
            {
              element.attr("tabindex", 0);
            }

            function updateRoot()
            {
              if (updating || !size)
              {
                return;
              }

              var changed = false;
              var scale = root.clientRect.width / size.width;
              var selections = scope.svgSelection;
              
              if (!selections)
              {
                scope.svgSelection = selections = [];
                changed = true;
              }

              ++updating;

              try
              {
                for(var i = 0; i < selections.length; ++i)
                {
                  var selection = selections[i];

                  if (!selection || !selection.path)
                  {
                    selections.splice(i--, 1);
                    changed = true;

                    continue;
                  }

                  var path = root.paths[i];

                  if (path)
                  {
                    if ((path.selection !== selection) ||
                      (path.selectionPath !== selection.path))
                    {
                      root.remove(i);
                      path = null;
                    }
                  }

                  if (!path)
                  {
                    path = root.insert(
                      {
                        d: SelectionTool.scalePath(selection.path, scale),
                        selected: selection.selected
                      },
                      i);
                  }

                  if (!path)
                  {
                    selections.splice(i--, 1);
                    changed = true;

                    continue;
                  }

                  path.selection = selection;
                  path.selectionPath = selection.path;

                  var selected = !!selection.selected;

                  if (path.selected !== selected)
                  {
                    path.selected = selected;
                  }
                }

                while(root.length > selections.length)
                {
                  root.remove(root.length - 1);
                }
              }
              finally
              {
                --updating;
              }

              if (changed)
              {
                scope.$applyAsync();
              }
            }

            function updateSelection()
            {
              if (updating || !size)
              {
                return;
              }

              var scale = size.width / root.clientRect.width;
              var selections = scope.svgSelection || (scope.svgSelection = []);
              var length = root.paths.length;

              for(var i = 0; i < length ; ++i)
              {
                var path = root.paths[i];
                var selection = path.selection || (path.selection = {});

                selection.selected = path.selected;
                selection.path = path.selectionPath =
                  SelectionTool.scalePath(path.d, scale);

                selections[i] = selection;
              }

              if (selections.length > length)
              {
                selections.splice(length, selections.length - length);
              }

              ++updating;

              try
              {
                scope.$apply();
              }
              finally
              {
                --updating;
              }
            }

            function loadImage(url)
            {
              cancelLoading();

              if (root)
              {
                root.imageSrc = url;
              }

              cancelLoading = SelectionTool.getImageSize(url, function(imageSize)
              {
                size = imageSize;

                if (root)
                {
                  var element = root.element;
                  var left = 0;
                  var top = 0;
                  var width = 100;
                  var height = 100;

                  if (size.width >= size.height)
                  {
                    height = size.height / size.width * 100;
                    top = (100 - height) / 2;
                  }
                  else
                  {
                    width = size.width / size.height * 100;
                    left = (100 - width) / 2;
                  }
                }

                element.style.marginLeft = left ? left + "%" : "";
                element.style.marginTop = top ? top + "%" : "";
                element.style.width = width + "%";
                element.style.height = height + "%";

                updateRoot();
                scope.$applyAsync();
              });
            }
          }
        };

        return definition;
      });

    return module;
  });
