Selection tool
===========

In a web project we needed to provide a region selection tool.

This requirement is resulted in a javascript module [selectionTool](https://github.com/nesterovsky-bros/selection/blob/master/js/selection/selectionTool.js), and in an angularjs wrappers [selection](https://github.com/nesterovsky-bros/selection/blob/master/js/selection/selection.js), and [clip](https://github.com/nesterovsky-bros/selection/blob/master/js/selection/clip.js)

There are samples [test.html](https://rawgit.com/nesterovsky-bros/selection/master/test.html), and [angularjs-test.html](https://rawgit.com/nesterovsky-bros/selection/master/angularjs-test.html).

The module is implemented through SVG manipulation. Selection paths are defined in terms of SVG.

The simplest way to start with  this API is through test pages.

From the client perspective API allows to:

 - create a new selection - click and drag path;
 - select/unselect selection - click selection overlay or image area;
 - move selected path - drag selected overlay, or click arrow keys;
 - move selected edge - drag selected edge;
 - move selected vertex - drag selected vertex;
 - delete selected path - Delete button;
 - add selection vertex - double click or ctrl + click a selection edge;
 - remove selection vertex - double click or ctrl + click a selection vertex;
 - scale selection - shift + drag selection, or shift + arrow keys;
 - rotate selection - ctrl + drag selection, or ctrl + arrow keys.


