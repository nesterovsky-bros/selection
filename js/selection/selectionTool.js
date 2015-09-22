/**
  @copyright 2014-2015 Nesterovsky bros.
  @module selectionTool 
  
  @description This module provides API make selection over image.

  Selection API operates over html template of the form:
    <div class="st-container" tabindex="0">
      <svg class="st-root" overflow="hidden">
        <g class="st-background">
          <image class="st-image" 
            preserveAspectRatio="xMinYMin meet" 
            width="100%" height="100%"/>
        </g>
        <g class="st-paths"></g>
        <g class="st-edges"></g>
        <g class="st-vertices"></g>
      </svg>
    </div>


    Image is put into st-image.
    Overlays, edges and vertices are modeled under 
    SVG's st-path, st-edges, st-vertices elements.

    API exposes SVG parts as objects: 
      {@link Item} - base object;
      {@link Root} - encapsulates whole working area;
      {@link Path} - encapsulates SVG path with overlay;
      {@link Vertex} - encapsulates a path vertex;
      {@link Edge} - encapsulates a path edge.

    In adition a {@link Transform} encapsulates shift, rotate and scale 
    transformations of the path.
*/
define(function()
{

"use strict";

/**
  An DOM event handler.
  @callback EventHandler
  @param {Event} event An event object.
 */

/**
  Unregister function.
  @callback UnregisterFunc
 */

/**
  An image size callback.
  @callback ImageSizeHandler
  @param {object} params A callback params.
  @param {number} params.width An image width.
  @param {number} params.height An image height.
 */


/** Id of the element's data. */
var dataId = "nb-st1";

/**
  SVG namespace.
  @const {string}
 */
var svgns = "http://www.w3.org/2000/svg";

/**
  xlink namespace.
  @const {string}
 */
var xlinkns = "http://www.w3.org/1999/xlink";

/**
 Selection change types.
 @enum {string}
*/
var ChangeType =
{
  /** A clear path event. */
  Clear: "clear",

  /** Insert path event. */
  Insert: "insert",

  /** Remove path event. */
  Remove: "remove",

  /** Transform path event. */
  Transform: "transform",

  /** Select path event. */
  Select: "select"
};

/**
  Gets or sets element's data.

  @param {Element} element A DOM element.
  @param {object} value A value to set, or 
    <code>undefined</code> to get value.
  @return an element value.
 */
function data(element, value)
{
  return value === undefined ? element[dataId] : (element[dataId] = value);
}

/**
  Registers an event over element, and returns an unregister function.
  @param {Element} element A DOM element.
  @param {string} type An event type.
  @param {EventHandler} handler An event handler.
  @return {UnregisterFunc} unregister function.
 */
function on(element, type, handler)
{
  element.addEventListener(type, handler);

  return function()
  {
    if (element)
    {
      element.removeEventListener(type, handler);
      element = null;
      type = null;
      handler = null;
    }
  };
};

/**
  Gets image and passes its size into a callback.
  @param {string} url An image url.
  @param {ImageSizeHandler} callback An image size handler.
  @return {UnregisterFunc} unregister function to prevent running operation.
 */
function getImageSize(url, callback)
{
  var image = new Image();
  var cancel = on(image, "load", function()
  {
    callback({ width: image.width, height: image.height });
    off();
  });

  image.src = url;

  return off;

  function off()
  {
    if (cancel)
    {
      cancel();
      cancel = null;
      image.src = "";
      image = null;
      url = null;
      callback = null;
    }
  }
}

/**
  Gets the bounding box of the {@link SVGElement} or {@link String}.
  @param {(SVGElement|String)} path A path as 
    {@link SVGElement} or {@link String}.
  @return {SVGRect} the bounding box
 */
function getBBox(path)
{
  if (typeof path !== "string")
  {
    return path.getBBox();
  }

  var element = document.createElementNS(svgns, "svg");
  var pathElement = document.createElementNS(svgns, "path");

  element.setAttribute("width", "0");
  element.setAttribute("height", "0");
  element.setAttribute("overflow", "hidden");
  pathElement.setAttribute("d", path);
  element.appendChild(pathElement);
  document.body.appendChild(element);

  try
  {
    return pathElement.getBBox();
  }
  finally
  {
    element.parentNode.removeChild(element);
  }
}

/** Map of SVG segment types and their properties. */
var fields = {};

fields.m = fields.M = fields.l = fields.L = fields.t = fields.T = ["x", "y"];
fields.c = fields.C = ["x", "y", "x1", "y1", "x2", "y2"];
fields.q = fields.Q = ["x", "y", "x1", "y1"];
fields.a = fields.A = ["x", "y", "r1", "r2"];
fields.h = fields.H = ["x"];
fields.v = fields.V = ["y"];
fields.s = fields.S = ["x", "y", "x2", "y2"];

/**
  Scales the path.
  @param {SVGElement|String} path A path to scale in 
    the form of {@link SVGElement} or {@link String}.
  @param {number} scale A scale factor.
  @return {SVGElement|String} Scaled path.
 */
function scalePath(path, scale)
{
  var isString = typeof path === "string";
  var element;

  if (isString)
  {
    element = document.createElementNS(svgns, "path");
    element.setAttribute("d", path)
  }
  else
  {
    element = path;
  }

  var segments = element.pathSegList;

  for(var i = 0, c = segments.numberOfItems; i < c; ++i)
  {
    var segment = segments.getItem(i);
    var segmentFields = fields[segment.pathSegTypeAsLetter];

    if (segmentFields)
    {
      for(var k = 0; k < segmentFields.length; ++k)
      {
        segment[segmentFields[k]] *= scale;
      }
    }
  }

  return isString ? element.getAttribute("d") : element;
}

/**
  A base class to encapsulate SVG elements.  
  @class
 */
function Item(element)
{
  this.element = element;
  data(element, this);
}

Item.prototype = Object.create(null,
{
  constructor: Item,

  /**
    Encapsulated DOM Element.
    @memberof Item
    @property {Element}
   */
  element: { enumerable: true, writable: true, value: null },

  /**
    Gets bounding client rect. @see {@link Element#getBoundingClientRect}.
    @memberof Item
    @function
    @returns {DOMRect}
   */
  clientRect:
  {
    enumerable: true,
    get: function() { return this.element.getBoundingClientRect(); }
  },

  /**
    Releases allocated resources and removes element from the tree.
    @memberof Item
    @function
   */
  release:
  {
    value: function()
    {
      var element = this.element;

      if (element)
      {
        this.element = null;
        data(this, element, null);
        element.parentNode && element.parentNode.removeChild(element);
      }
    }
  }
});

/**
  Encapsulates whole working area.
  @class
  @augments Item
  @param {Element} containerElement a container working area.
 */
function Root(containerElement)
{
  var self = this;
  var element = containerElement.querySelector(selectorFor("root"));
  var pathsElement = element.querySelector(selectorFor("paths"));
  var offs = [];

  Item.call(self, element);
  self.paths = [];
  self.offs = offs;
  self.containerElement = containerElement;
  self.pathsElement = pathsElement;
  self.edgesElement = element.querySelector(selectorFor("edges"));
  self.verticesElement = element.querySelector(selectorFor("vertices"));
  self.imageElement = element.querySelector(selectorFor("image"));

  Array.prototype.forEach.call(
    pathsElement.querySelectorAll(selectorFor("path")),
    function(element) { createPath(element, self); });

  offs.push(on(element, "contextmenu", preventDefault));
  offs.push(on(element, "mousedown", drag));
  offs.push(on(element, "dblclick", dblclick));
  offs.push(on(containerElement, "keydown",
    function(event) { keyEvent(event, keymap, self); }));
}

Root.prototype = Object.create(Item.prototype,
{
  constructor: Root,

  /**
    Refers to the container element.
    @memberof Root
    @property {Element}
   */
  containerElement: { enumerable: true, writable: true, value: null },

  /**
    Refers to the paths container element.
    @memberof Root
    @property {Element}
   */
  pathsElement: { enumerable: true, writable: true, value: null },

  /**
    Refers to the edges container element.
    @memberof Root
    @property {Element}
   */
  edgesElement: { enumerable: true, writable: true, value: null },

  /**
    Refers to the vertices container element.
    @memberof Root
    @property {Element}
   */
  verticesElement: { enumerable: true, writable: true, value: null },

  /**
    Refers to the image element.
    @memberof Root
    @property {Element}
   */
  imageElement: { enumerable: true, writable: true, value: null },

  /**
    Gets an array of paths.
    Do not directly update path array, but use {@link Root}'s methods 
    to manipulate with selection.
    @memberof Root
    @property {Array.<Path>}
   */
  paths: { enumerable: true, writable: true, value: null },

  /**
    Indicates whether the selection is fixed (read only).
    @memberof Root
    @property {boolean}
   */
  readonly: { enumerable: true, writable: true, value: false },

  /**
    @memberof Root
    @function
    @override
    @inheritdoc
   */
  release:
  {
    value: function()
    {
      this.offs.forEach(function(fn) { fn(); })
      this.offs.length = 0;
      this.paths.forEach(function(path) { path.release(); });
      this.paths.length = 0;
      this.pathsElement = null;
      this.edgesElement = null;
      this.verticesElement = null;
      this.imageElement = null;
      Item.prototype.release.call(this);
    }
  },

  /**
    Registers the specified listener.
    @memberof Root
    @function
    @param {string} type An event type to listen for.
    @param {EventHandler} handler A notification handler.
   */
  addEventListener:
  {
    value: function(type, handler)
    {
      this.containerElement.addEventListener(type, handler);
    }
  },

  /**
    Removes the event listener previously registered with {@link Root#addEventListener()}.
    @memberof Root
    @function
    @param {string} type An event type to remove.
    @param {EventHandler} handler A notification handler to remove.
   */
  removeEventListener:
  {
    value: function(type, handler)
    {
      this.containerElement.removeEventListener(type, handler);
    }
  },

  /**
    Triggers "change" event.
    @memberof Root
    @function
    @param {ChangeType} action An action type.
    @param {Path} [path] Optional path reference.
   */
  change:
  {
    value: function(action, path)
    {
      var details = { action: action, path: path };
      var event;

      if (typeof CustomEvent == "function")
      {
        event = new CustomEvent("change", { detail: details });
      }
      else
      {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent("change", true, false, details);
      }

      this.containerElement.dispatchEvent(event);
    }
  },

  /**
    Image source url.
    @memberof Root
    @property {string}
   */
  imageSrc:
  {
    enumerable: true,
    get: function()
    {
      return this.imageElement.getAttributeNS(xlinkns, "href");
    },
    set: function(value)
    {
      this.imageElement.setAttributeNS(xlinkns, "href", value);
    }
  },

  /**
    Get number of paths.
    @memberof Root
    @property {number}
   */
  length:
  {
    enumerable: true,
    get: function() { return this.paths.length; }
  },

  /**
    Clears path array.
    @memberof Root
    @function
   */
  clear:
  {
    value: function()
    {
      if (this.paths.length)
      {
        this.paths.forEach(function(path) { path.release(); });
        this.paths.length = 0;
        this.change(ChangeType.Clear);
      }
    }
  },

  /**
    Gets path by index.
    @memberof Root
    @function
    @param {number} index A path index.
    @returns {Path} a {@link Path} instance.
  */
  get: { value: function(index) { return this.paths[index]; } },

  /**
    Inserts a new path.
    @memberof Root
    @function
    @param {object} options Path options
    @param {string} options.d SVG path.
    @param {boolean} [options.selected] path selection indicator.
    @param {number} [index] A path index.
    @returns {Path} a new {@link Path} instance.
   */
  insert:
  {
    value: function(options, index)
    {
      var paths = this.paths;

      index = index === undefined ? paths.length :
        index < 0 ? 0 : index > paths.length ? paths.length : index;

      var element = document.createElementNS(svgns, "path");

      element.setAttribute("class", classFor("path"));
      element.setAttribute("d", options.d);

      var path = createPath(element, this);

      if (!path)
      {
        return null;
      }

      if (options.selected)
      {
        path.selected = true;
      }

      this.change(ChangeType.Insert, path);

      return path;
    }
  },

  /**
    Removes a path with a specified index.
    @memberof Root
    @function
    @param {number} index A path index.
   */
  remove:
  {
    value: function(index)
    {
      var path = this.paths[index];

      if (path)
      {
        this.paths.splice(index, 1);
        this.change(ChangeType.Remove, path);
        path.release();
      }
    }
  }
});

/**
  Encapsulates SVG path with overlay.
  @class
  @augments Item
  @param {SVGElement} element A SVG path {@link Element}.
  @param {Root} root A {@link Root} instance.
 */
function Path(element, root)
{
  var self = this;
  var smooth = false;
  var edge = null;
  var prevAssigned;
  var prevType = null;
  var prevX;
  var prevY;
  var initialVertex = null;
  var initial = null;
  var initialX = 0;
  var initialY = 0;
  var currentX = 0;
  var currentY = 0;
  var segments = element.pathSegList;
  var index = 0;

  Item.call(self, element);
  self.root = root;
  self.edges = [];
  self.vertices = [];

Iteration:
  while(index < segments.numberOfItems)
  {
    var item = segments.getItem(index);

Test:
    while(true)
    {
      var type = item.pathSegTypeAsLetter;

      if (!initial && !initialVertex && (type !== "M"))
      {
        item = segments.insertItemBefore(
          element.createSVGPathSegMovetoAbs(initialX, initialY),
          index);

        continue Test;
      }

      var edgeItem = null;
      var x = item.x;
      var y = item.y;
      var x1 = item.x1;
      var y1 = item.y1;
      var x2 = item.x2;
      var y2 = item.y2;

      switch(type)
      {
        default:
        {
          segments.removeItem(index);

          continue Iteration;
        }
        case "z":
        case "Z":
        {
          if ((initialX !== currentX) || (initialY !== currentY))
          {
            item = segments.insertItemBefore(
              element.createSVGPathSegLinetoAbs(initialX, initialY),
              index);

            continue Test;
          }

          switch(prevType)
          {
            case "z":
            case "Z":
            case "M":
            {
              segments.removeItem(index);

              continue Iteration;
            }
          }

          if (edge)
          {
            edge.end = initialVertex;
            initialVertex.incoming = edge;
            edge = null;
            initialVertex = null;
          }

          x = initialX;
          y = initialY;

          break;
        }
        case "m":
        {
          x += currentX;
          y += currentY;
          item = segments.replaceItem(
            element.createSVGPathSegMovetoAbs(x, y),
            index);

          // Path through
        }
        case "M":
        {
          switch(prevType)
          {
            case "M":
            {
              segments.removeItem(--index);

              break;
            }
            case null:
            case "z":
            case "Z":
            {
              break;
            }
            default:
            {
              item = segments.insertItemBefore(
                element.createSVGPathSegClosePath(),
                index);

              continue Test;
            }
          }

          if (edge)
          {
            var vertex = createVertex(self, currentX, currentY);

            edge.end = vertex;
            vertex.incoming = edge;
            edge = null;
          }

          initial = item;
          initialX = x;
          initialY = y;

          break;
        }
        case "l":
        {
          x += currentX;
          y += currentY;
          item = segments.replaceItem(
            element.createSVGPathSegLinetoAbs(x, y),
            index);

          // Path through
        }
        case "L":
        {
          edgeItem = element.createSVGPathSegLinetoAbs(x, y);

          break;
        }
        case "c":
        {
          x += currentX;
          y += currentY;
          x1 += currentX;
          y1 += currentY;
          x2 += currentX;
          y2 += currentY;
          item = segments.replaceItem(
            element.createSVGPathSegCurvetoCubicAbs(x, y, x1, y1, x2, y2),
            index);
          type = "C";

          // Path through
        }
        case "C":
        {
          edgeItem =
            element.createSVGPathSegCurvetoCubicAbs(x, y, x1, y1, x2, y2);

          break;
        }
        case "q":
        {
          x += currentX;
          y += currentY;
          x1 += currentX;
          y1 += currentY;

          // Path through
        }
        case "Q":
        {
          prevAssigned = true;
          prevType = "Q";
          prevX = x1;
          prevY = y1;

          x2 = x + (x1 - x) * 2 / 3;
          y2 = y + (y1 - y) * 2 / 3;
          x1 = currentX + (x1 - currentX) * 2 / 3;
          y1 = currentY + (y1 - currentY) * 2 / 3;

          item = segments.replaceItem(
            element.createSVGPathSegCurvetoCubicAbs(x, y, x1, y1, x2, y2),
            index);

          continue Test;
        }
        case "a":
        {
          x += currentX;
          y += currentY;
          item = segments.replaceItem(
            element.createSVGPathSegArcAbs(
              x,
              y,
              item.r1,
              item.r2,
              item.angle,
              item.largeArcFlag,
              item.sweepFlag),
            index);

          // Path through
        }
        case "A":
        {
          edgeItem = element.createSVGPathSegArcAbs(
            x,
            y,
            item.r1,
            item.r2,
            item.angle,
            item.largeArcFlag,
            item.sweepFlag);

          break;
        }
        case "h":
        {
          x += currentX;

          // Path through
        }
        case "H":
        {
          item = segments.replaceItem(
            element.createSVGPathSegLinetoAbs(x, y),
            index);

          continue Test;
        }
        case "v":
        {
          y += currentY;

          // Path through
        }
        case "V":
        {
          item = segments.replaceItem(
            element.createSVGPathSegLinetoAbs(x, y),
            index);

          continue Test;
        }
        case "s":
        {
          x += currentX;
          y += currentY;
          x2 += currentX;
          y2 += currentY;

          // Path through
        }
        case "S":
        {
          if (prevType === "C")
          {
            x1 = currentX * 2 - prevX;
            y1 = currentY * 2 - prevY;
            smooth = true;
          }
          else
          {
            x1 = currentX;
            y1 = currentY;
          }

          prevAssigned = true;
          prevType = "C";
          prevX = x2;
          prevY = y2;

          item = segments.replaceItem(
            element.createSVGPathSegCurvetoCubicAbs(x, y, x1, y1, x2, y2),
            index);

          continue Test;
        }
        case "t":
        {
          x += currentX;
          y += currentY;

          // Path through
        }
        case "T":
        {
          if (prevType === "Q")
          {
            x1 = currentX * 2 - prevX;
            y1 = currentY * 2 - prevY;
            smooth = true;
          }
          else
          {
            x1 = currentX;
            y1 = currentY;
          }

          prevAssigned = true;
          prevType = "Q";
          prevX = x1;
          prevY = y1;

          x2 = x + (x1 - x) * 2 / 3;
          y2 = y + (y1 - y) * 2 / 3;
          x1 = currentX + (x1 - currentX) * 2 / 3;
          y1 = currentY + (y1 - currentY) * 2 / 3;

          item = segments.replaceItem(
            element.createSVGPathSegCurvetoCubicAbs(x, y, x1, y1, x2, y2),
            index);

          continue Test;
        }
      }

      break Test;
    }

    if (prevAssigned)
    {
      prevAssigned = false;
    }
    else
    {
      prevType = type;
    }

    if (edgeItem)
    {
      var vertex;

      if (!edge)
      {
        vertex = createVertex(self, initialX, initialY, initial);
        initial = null;
        initialVertex = vertex;
      }
      else
      {
        vertex = createVertex(self, currentX, currentY);
        edge.end = vertex;
        vertex.incoming = edge;
      }

      edge = createEdge(self, currentX, currentY, edgeItem, item);
      edge.start = vertex;
      vertex.smooth = smooth;
      vertex.outgoing = edge;
      smooth = false;
    }

    currentX = x;
    currentY = y;

    if (++index === segments.numberOfItems)
    {
      if (edge)
      {
        item = segments.appendItem(element.createSVGPathSegClosePath());
      }
      else if (initial)
      {
        segments.removeItem(index - 1);
      }
      // No more cases
    }
  }
}

Path.prototype = Object.create(Item.prototype,
{
  constructor: Path,

  /**
    Refers to the {@link Root} instance.
    @memberof Path
    @property {Root}
   */
  root: { enumerable: true, writable: true, value: null },

  /**
    Path edges.
    @memberof Path
    @property {Array.<Edge>}.
   */
  edges: { enumerable: true, writable: true, value: null },

  /**
    Path vertices.
    @memberof Path
    @property {Array.<Vertex>}.
   */
  vertices: { enumerable: true, writable: true, value: null },

  /**
    Gets a SVG path.
    @memberof Path
    @property {string}.
   */
  d:
  {
    enumerable: true,
    get: function() { return this.element && this.element.getAttribute("d"); }
  },

  /**
    Path selection indicator.
    @memberof Path
    @property {boolean}.
   */
  selected: 
  { 
    enumerable: true,
    get: function()
    {
      return !!(this.element && this.element.getAttribute("selected"));
    },
    set: function(value)
    {
      function toggle(element)
      {
        element &&
        (value ?
          element.setAttribute("selected", "selected") :
          element.removeAttribute("selected"));
      }

      toggle(this.element);
      this.vertices.forEach(function(vertex) { toggle(vertex.element); });
      this.edges.forEach(function(edge) { toggle(edge.element); });
    }
  },

  /**
    @memberof Path
    @function
    @override
    @inheritdoc
   */
  release:
  {
    value: function()
    {
      this.edges.forEach(function(edge) { edge.release(); });
      this.edges.length = 0;
      this.vertices.forEach(function(vertex) { vertex.release(); });
      this.vertices.length = 0;
      Item.prototype.release.call(this);
    }
  }
});

/**
  Encapsulates a path vertex.
  @class
  @augments Item
  @param {SVGElement} element A SVG vertex path.
  @param {Path} path A {@link Path} instance.
 */
function Vertex(element, path)
{
  Item.call(this, element);
  this.path = path;
}

Vertex.prototype = Object.create(Item.prototype,
{
  constructor: Vertex,

  /**
    Refers to the {@link Path} instance.
    @memberof Vertex
    @property {Path}
   */
  path: { enumerable: true, writable: true, value: null },

  /**
    Smooth vertex indicator.
    When value is true then the line passing through this vertex is smooth;
    otherwise it can be uneven.
    @memberof Vertex
    @property {boolean}
   */
  smooth: { enumerable: true, writable: true, value: false },

  /**
    A segment of path for which the vertex is a start point.
    @memberof Vertex
    @property {SVGPathSeg}
   */
  segment: { enumerable: true, writable: true, value: null },

  /**
    Incoming {@link Edge}.
    @memberof Vertex
    @property {Edge}
   */
  incoming: { enumerable: true, writable: true, value: null },

  /**
    Outgoing {@link Edge}.
    @memberof Vertex
    @property {Edge}
   */
  outgoing: { enumerable: true, writable: true, value: null },

  /**
    @memberof Vertex
    @function
    @override
    @inheritdoc
   */
  release:
  {
    value: function()
    {
      this.segment = null;
      this.incoming = null;
      this.outgoing = null;
      Item.prototype.release.call(this);
    }
  }
});

/**
  Encapsulates a path edge.
  @class
  @augments Item
  @param {SVGElement} element A SVG vertex path.
  @param {Path} path A {@link Path} instance.
 */
function Edge(element, path)
{
  Item.call(this, element);
  this.path = path;
}

Edge.prototype = Object.create(Item.prototype,
{
  constructor: Edge,

  /**
    Refers to the {@link Path} instance.
    @memberof Edge
    @property {Path}
   */
  path: { enumerable: true, writable: true, value: null },

  /**
    A segment of path that corresponds to the edge.
    @memberof Edge
    @property {SVGPathSeg}
   */
  segment: { enumerable: true, writable: true, value: null },

  /**
    Start {@link Vertex}.
    @memberof Edge
    @property {Vertex}ю
   */
  start: { enumerable: true, writable: true, value: null },

  /**
    End {@link Vertex}.
    @memberof Edge
    @property {Vertex}ю
   */
  end: { enumerable: true, writable: true, value: null },

  /**
    @memberof Edge
    @function
    @override
    @inheritdoc
   */
  release:
  {
    value: function()
    {
      this.segment = null;
      this.start = null;
      this.end = null;
      Item.prototype.release.call(this);
    }
  }
});

/**
  Encapsulates shift, rotate and scale transformations of the path.
  @class
  @param {(Path|Edge|Vertex)} item to transform.
 */
function Transform(item)
{
  var path;

  if (item instanceof Path)
  {
    path = item;

    this._vertices = path.vertices.map(function(vertex)
    {
      return (
      {
        vertex: vertex,
        x: vertex.element.cx.baseVal.value,
        y: vertex.element.cy.baseVal.value
      });
    });

    this._edges = path.edges.map(function(edge)
    {
      var segments = edge.element.pathSegList;
      var from = segments.getItem(0);
      var to = segments.getItem(1);

      return (
      {
        edge: edge,
        x0: from.x,
        y0: from.y,
        x: to.x,
        y: to.y,
        x1: to.x1,
        y1: to.y1,
        x2: to.x2,
        y2: to.y2,
        r1: to.r1,
        r2: to.r2,
        angle: to.angle
      });
    });
  }
  else
  {
    var path = item.path;
    var data = item instanceof Edge ? [item.start, item.end] :
      item instanceof Vertex ? [item] : [];

    this._vertex = data.map(function(vertex)
    {
      var incoming = vertex.incoming;
      var outgoing = vertex.outgoing;
      var element = vertex.element;

      return (
      {
        vertex: vertex,
        incoming: incoming,
        outgoing: outgoing,
        element: element,
        px: element.cx.baseVal.value,
        py: element.cy.baseVal.value,
        x1: incoming.x1,
        y1: incoming.y1,
        x2: outgoing.x2,
        y2: outgoing.y2
      });
    });
  }

  var bounds = path.element.getBBox();
  
  this.path = path;
  this.bounds = bounds;
  this.cx = bounds.x + bounds.width / 2;
  this.cy = bounds.y + bounds.height / 2;
}

Transform.prototype = Object.create(null,
{
  /**
    {@link Path} instance.
    @memberof Transform
    @property {Path}
   */
  path: { enumerable: true, writable: true, value: null },

  /**
    The bounding box.
    @memberof Transform
    @property {SVGRect}
   */
  bounds: { enumerable: true, writable: true, value: null },

  /**
    Item center on x axis.
    @memberof Transform
    @property {number}
   */
  cx: { enumerable: true, writable: true, value: null },

  /**
    Item center on y axis.
    @memberof Transform
    @property {number}
   */
  cy: { enumerable: true, writable: true, value: null },

  /**
    Transforms the item.
    @memberof Transform
    @function
    @param {object} options Transform options.
    @param {number} [options.cx] new center on x axis.
    @param {number} [options.cy] new center on y axis.
    @param {number} [options.dx] item x offset.
    @param {number} [options.dy] item y offset.
    @param {number} [options.s] item scale factor.
    @param {number} [options.sy] item y scale factor.
    @param {number} [options.angle] item rotation angle in degrees.
    @param {number} [options.sin] item sin(angle / 180 * PI).
    @param {number} [options.cos] item cos(angle / 180 * PI).
   */
  transform:
  {
    value: function(options)
    {
      options || (options = {});

      var self = this;
      var path = self.path;
      var cx = options.cx === undefined ? self.cx : options.cx;
      var cy = options.cy === undefined ? self.cy : options.cy;
      var dx = options.dx || 0;
      var dy = options.dy || 0;
      var s = options.s === undefined ? 1 : options.s;
      var sy = options.sy === undefined ? s : options.sy;
      var angle = options.angle;
      var sin = options.sin;
      var cos = options.cos;

      if (angle === undefined)
      {
        if ((sin === undefined) || (cos === undefined))
        {
          angle = 0;
          sin = 0;
          cos = 1;
        }
        else
        {
          angle = Math.atan2(sin, cos) / Math.PI * 180;
        }
      }
      else
      {
        if ((sin === undefined) || (cos === undefined))
        {
          var angle_pi = angle / 180 * Math.PI;

          sin = Math.sin(angle_pi);
          cos = Math.cos(angle_pi);
        }
      }

      if (self._vertex)
      {
        self._vertex.forEach(function(item)
        {
          var x = item.px + dx;
          var y = item.py + dy;

          item.element.cx.baseVal.value = x;
          item.element.cy.baseVal.value = y;

          if (item.vertex.segment)
          {
            item.vertex.segment.x = x;
            item.vertex.segment.y = y;
          }

          var segments = item.outgoing.element.pathSegList;
          var from = segments.getItem(0);
          var to = segments.getItem(1);

          from.x = x;
          from.y = y;

          if (to.pathSegTypeAsLetter === "C")
          {
            item.outgoing.segment.x1 = to.x1 = item.x1 + dx;
            item.outgoing.segment.y1 = to.y1 = item.y1 + dy;
          }

          segments = item.incoming.element.pathSegList;
          from = segments.getItem(0);
          to = segments.getItem(1);

          item.incoming.segment.x = to.x = x;
          item.incoming.segment.y = to.y = y;

          if (to.pathSegTypeAsLetter === "C")
          {
            item.incoming.segment.x2 = to.x2 = item.x2 + dx;
            item.incoming.segment.y2 = to.y2 = item.y2 + dy;
          }
        });
      }
      else
      {
        var a;
        var b;
        var c;
        var d;

        a = cos * s;
        b = -sin * s;
        c = sin * sy;
        d = cos * sy;

        var transformPoint = function(p)
        {
          return (
          {
            x: (p.x - cx) * a + (p.y - cy) * b + cx + dx,
            y: (p.x - cx) * c + (p.y - cy) * d + cy + dy
          });
        }

        var transform = function(segment, data)
        {
          var p = transformPoint(data);

          segment.x = p.x;
          segment.y = p.y;

          if (segment.pathSegTypeAsLetter === "C")
          {
            var p1 = transformPoint({ x: data.x1, y: data.y1 });
            var p2 = transformPoint({ x: data.x2, y: data.y2 });

            segment.x1 = p1.x;
            segment.y1 = p1.y;
            segment.x2 = p2.x;
            segment.y2 = p2.y;
          }
          else if (segment.pathSegTypeAsLetter === "A")
          {
            segment.r1 = data.r1 * s;
            segment.r2 = data.r2 * s;
            segment.angle = (data.angle + angle) % 360;
          }
          // No more cases
        }

        path.vertices.forEach(function(vertex, index)
        {
          var p = transformPoint(self._vertices[index]);

          vertex.element.cx.baseVal.value = p.x;
          vertex.element.cy.baseVal.value = p.y;

          var segment = vertex.segment;

          if (segment)
          {
            segment.x = p.x;
            segment.y = p.y;
          }
        });

        path.edges.forEach(function(edge, index)
        {
          var data = self._edges[index];
          var segments = edge.element.pathSegList;
          var from = segments.getItem(0);
          var to = segments.getItem(1);
          var p = transformPoint({ x: data.x0, y: data.y0 });

          from.x = p.x;
          from.y = p.y;
          transform(to, data);
          transform(edge.segment, data);
        });
      }
    }
  }
});

/**
  Creates an {@link Edge} instance.
  @private
  @param {Path} path A {@link Path} instance.
  @param {number} x X coordinate.
  @param {number} y Y coordinate.
  @param {SVGPathSeg} edge An edge segment.
  @param {SVGPathSeg} path A path segment.
  @param {number} index An edge index.
  @returns {Edge}
 */
function createEdge(path, x, y, edgeItem, pathItem, index)
{
  var root = path.root;
  var edgeElement = document.createElementNS(svgns, "path");

  edgeElement.setAttribute("class", classFor("edge"));
  edgeElement.pathSegList.appendItem(
    edgeElement.createSVGPathSegMovetoAbs(x, y));
  edgeElement.pathSegList.appendItem(edgeItem);
  path.selected && edgeElement.setAttribute("selected", "selected");
  root.edgesElement.appendChild(edgeElement);

  var edge = new Edge(edgeElement, path);

  edge.segment = pathItem;
  path.edges.splice(index || path.edges.length, 0, edge);

  return edge;
}

/**
  Creates a {@link Vertex} instance.
  @private
  @param {Path} path A {@link Path} instance.
  @param {number} x X coordinate.
  @param {number} y Y coordinate.
  @param {SVGPathSeg} segment A segment.
  @param {number} index A vertex index.
  @returns {Vertex}
 */
function createVertex(path, x, y, segment, index)
{
  var root = path.root;
  var vertexElement = document.createElementNS(svgns, "circle");

  vertexElement.cx.baseVal.value = x;
  vertexElement.cy.baseVal.value = y;
  vertexElement.r.baseVal.value = 4;
  vertexElement.setAttribute("class", classFor("vertex"));
  path.selected && vertexElement.setAttribute("selected", "selected");
  root.verticesElement.appendChild(vertexElement);

  var vertex = new Vertex(vertexElement, path);

  vertex.segment = segment || null;
  path.vertices.splice(index || path.vertices.length, 0, vertex);

  return vertex;
}

/**
  Gets a segment index.
  @private
  @param {SVGPathSegList} segments A segments collection.
  @param {SVGPathSeg} segment A segment to get index for.
  @returns {number} A segment index, or undefined if not segment is found.
 */
function segmentIndex(segments, segment)
{
  for(var i = 0, c = segments.numberOfItems; i < c; ++i)
  {
    if (segments.getItem(i) === segment)
    {
      return i;
    }
  }
}

/**
  Deletes a {@link Vertex}.
  @private
  @param {Vertex} vertex A {link Vertex} instance.
 */
function deleteVertex(vertex)
{
  var path = vertex.path;
  var root = path.root;
  var incoming = vertex.incoming;
  var outgoing = vertex.outgoing;
  var segments = path.element.pathSegList;
  var segment = outgoing.segment;
  var index = segmentIndex(segments, segment);

  if (index === undefined)
  {
    return;
  }

  var last = incoming === outgoing;

  if (!last)
  {
    var next = outgoing.end;

    segment = incoming.element.pathSegList.getItem(1);
    incoming.segment.x = outgoing.segment.x;
    incoming.segment.y = outgoing.segment.y;
    segment.x = outgoing.segment.x;
    segment.y = outgoing.segment.y;
    incoming.end = next;
    next.incoming = incoming;
    segments.removeItem(index);
    path.vertices.splice(path.vertices.indexOf(vertex), 1);
    path.edges.splice(path.edges.indexOf(outgoing), 1);

    if (vertex.segment)
    {
      next.segment = vertex.segment;
      vertex.segment.x = outgoing.segment.x;
      vertex.segment.y = outgoing.segment.y;
    }
    else
    {
      --index;
    }

    outgoing.release();
    vertex.release();
    vertex = next;

    last = (incoming === next.outgoing) &&
      (incoming.element.getTotalLength() === 0);
  }

  var removed = false;

  if (last)
  {
    segments.removeItem(index + 1);
    segments.removeItem(index);
    segments.removeItem(index - 1);
    path.vertices.splice(path.vertices.indexOf(vertex), 1);
    path.edges.splice(path.edges.indexOf(incoming), 1);
    incoming.release();
    vertex.release();

    if (!path.vertices.length)
    {
      removed = true;
      root.paths.splice(root.paths.indexOf(path), 1);
      root.change(ChangeType.Remove, path);
      path.release();
    }
  }

  if (!removed)
  {
    root.change(ChangeType.Transform, path);
  }
}

/**
  Splites an {@link Edge}.
  @private
  @param {Edge} edge An edge to split.
  @param {number} x An abscissa of a split point.
  @param {number} y An ordinate of a split point.
 */
function splitEdge(edge, x, y)
{
  var path = edge.path;
  var root = path.root;
  var pathElement = path.element;
  var segments = pathElement.pathSegList;
  var segment = edge.segment;
  var index = segmentIndex(segments, segment);

  if (index === undefined)
  {
    return null;
  }

  var item = pathElement.createSVGPathSegLinetoAbs(segment.x, segment.y);
  var edgeItem = pathElement.createSVGPathSegLinetoAbs(segment.x, segment.y);
  var to = edge.element.pathSegList.getItem(1);

  to.x = segment.x = x;
  to.y = segment.y = y;
  item = segments.insertItemBefore(item, index + 1);

  var vertex = createVertex(path, x, y, null, path.vertices.indexOf(edge.end));

  var split = createEdge(
    path,
    x,
    y,
    edgeItem,
    item,
    path.edges.indexOf(edge));

  split.end = edge.end;
  split.end.incoming = split;
  split.start = vertex;
  vertex.outgoing = split;
  vertex.incoming = edge;
  edge.end = vertex;
  root.change(ChangeType.Transform, path);

  return vertex;
}

/**
  Creates {@link Path} for a {@link SVGElement}.
  @private
  @param {SVGElement} element A {@link SVGElement} instance.
  @param {Root} root A {@link Root} instance.
  @param {number} index A path index.
 */
function createPath(element, root, index)
{
  var path = new Path(element, root);

  if ((path.vertices.length <= 1) && (path.element.getTotalLength() > 0))
  {
    path.release();

    return null;
  }

  var paths = root.paths;
  var reference = paths[index];

  if (!element.parentNode)
  {
    if (reference)
    {
      root.pathsElement.insertBefore(element, reference.element);
    }
    else
    {
      root.pathsElement.appendChild(element);
    }
  }

  paths.splice(reference ? index : paths.length, 0, path);

  return path;
}

/**
  Creates a rectangular {@link Path}.
  @private
  @param {Root} root A {@link Root} instance.
  @param {number} left A left abscissa of the rectangle.
  @param {number} top A top ordinate of the rectangle.
  @param {number} right A right abscissa of the rectangle.
  @param {number} bottom A bottom ordinate of the rectangle.
 */
function createRectPath(root, left, top, right, bottom)
{
  var element = document.createElementNS(svgns, "path");
  var segments = element.pathSegList;

  element.setAttribute("class", classFor("path"));

  segments.appendItem(element.createSVGPathSegMovetoAbs(left, top));
  segments.appendItem(element.createSVGPathSegLinetoAbs(right, top));
  segments.appendItem(element.createSVGPathSegLinetoAbs(right, bottom));
  segments.appendItem(element.createSVGPathSegLinetoAbs(left, bottom));
  segments.appendItem(element.createSVGPathSegLinetoAbs(left, top));
  segments.appendItem(element.createSVGPathSegClosePath());

  var path = createPath(element, root);

  path.selected = true;
  root.change(ChangeType.Transform, path);

  return path;
}

/** @private */
var movingAction = 1;

/** @private */
var deletingVertexAction = 2;

/** @private */
var creatingPathAction = 3;

/** @private */
var draggingVertex = 1;

/** @private */
var draggingEdge = 2;

/** @private */
var draggingPath = 4;

/** @private */
var draggingRoot = 8;

/**
  Drag event handler.
  @private
  @param {Event} event An event instance.
 */
function drag(event)
{
  var item = data(event.target);
  var path;
  var dragging = item instanceof Path ? ((path = item), draggingPath) :
    item instanceof Vertex ? ((path = item.path), draggingVertex) :
    item instanceof Edge ? ((path = item.path), draggingEdge) : 
    item instanceof Root ? draggingRoot : null;

  if (!dragging)
  {
    return;
  }

  var root = path ? path.root : item;
  var clientRect = root.clientRect;
  var pageX = event.pageX;
  var pageY = event.pageY;
  var px = event.clientX - clientRect.left;
  var py = event.clientY - clientRect.top;
  var transform;
  var cx;
  var cy;
  var vx;
  var vy;
  var r;
  var ctrl = event.ctrlKey;
  var shift = event.shiftKey;
  var cancelled;
  var splitted;
  var action;

  event.preventDefault();

  if (root.containerElement !== document.activeElement)
  {
    root.containerElement.focus();
  }

  if (path)
  {
    !path.selected && selectPath(root, path);
  }
  else
  {
    selectPath(root, null);
    action = creatingPathAction;
  }

  if (root.readonly)
  {
    return;
  }

  switch(dragging)
  {
    case draggingVertex:
    {
      if (shift)
      {
        dragging = draggingPath;
        item = path;
      }
      else if (ctrl)
      {
        action = deletingVertexAction;
      }
      else
      {
        action = movingAction;
      }

      break;
    }
    case draggingEdge:
    {
      if (shift)
      {
        dragging = draggingPath;
        item = path;
      }
      else if (ctrl)
      {
        item = splitEdge(item, px, py);
        splitted = true;
        dragging = draggingVertex;
        action = movingAction;
      }
      else
      {
        action = movingAction;
      }

      break;
    }
    case draggingPath:
    {
      if (!ctrl && !shift)
      {
        action = movingAction;
      }

      break;
    }
  }

  var keymap =
  [
    {
      key: keys.escape,
      handler: function(event)
      {
        if (action === creatingPathAction)
        {
          if (path)
          {
            root.paths.splice(root.paths.indexOf(path), 1);
            path.release();
          }
        }
        else
        {
          transform && transform.transform();
          splitted && deleteVertex(item);
        }

        cancelled = true;
        end(event);
      }
    }
  ];

  var keydownOff =
    on(document, "keydown", function(event) { keyEvent(event, keymap); });
  var moveOff = on(document, "mousemove", move);
  var endOff = on(document, "mouseup", end);

  function move(event)
  {
    var ctrl = event.ctrlKey;
    var shift = event.shiftKey;
    var px2 = event.pageX - pageX + px;
    var py2 = event.pageY - pageY + py;

    px2 = px2 < 0 ? 0 : px2 > clientRect.width ? clientRect.width : px2;
    py2 = py2 < 0 ? 0 : py2 > clientRect.height ? clientRect.height : py2;

    switch(action)
    {
      case deletingVertexAction:
      {
        action = movingAction;
        dragging = draggingVertex;

        break;
      }
      case creatingPathAction:
      {
        if (!path)
        {
          path = item = createRectPath(root, px, py, px + 10, py + 10);
        }

        break;
      }
    }

    if (!transform)
    {
      transform = new Transform(item);
      cx = transform.cx;
      cy = transform.cy;
      vx = px - cx;
      vy = py - cy;
      r = Math.sqrt(vx * vx + vy * vy);
    }

    var options;

    switch(action)
    {
      case movingAction:
      {
        options = { dx: px2 - px, dy: py2 - py };

        break;
      }
      case creatingPathAction:
      {
        options = { cx: px, cy: py, s: (px2 - px) / 10, sy: (py2 - py) / 10 };

        break;
      }
      default:
      {
        var vx2 = px2 - cx;
        var vy2 = py2 - cy;
        var r2 = Math.sqrt(vx2 * vx2 + vy2 * vy2);
        var rr = r * r2;
        var s = shift || !r ? r2 / r : 1;
        var sin = ctrl ? (vx * vy2 - vx2 * vy) / rr : 0;
        var cos = ctrl ? (vx * vx2 + vy * vy2) / rr : 1;

        options = { s: s, sin: sin, cos: cos };

        break;
      }
    }

    transform.transform(options);
    event.preventDefault();
  }

  function end(event)
  {
    var ctrl = event.ctrlKey;
    var shift = event.shiftKey;

    event.preventDefault();
    moveOff();
    keydownOff();
    endOff();

    if (!cancelled)
    {
      if (action === deletingVertexAction)
      {
        ctrl && !shift && deleteVertex(item);
      }
      else
      {
        transform && root.change(ChangeType.Transform, transform.path);
      }
    }
  }
}

/**
  Double click event handler. 
  @private
  @param {Event} event An event instance.
 */
function dblclick(event)
{
  var item = data(event.target);
  var isVertex = item instanceof Vertex ? true :
    item instanceof Edge ? false : null;

  if (isVertex === null)
  {
    return;
  }

  if (item.path.root.readonly)
  {
    return;
  }

  event.preventDefault();

  if (isVertex)
  {
    deleteVertex(item)
  }
  else
  {
    var clientRect = item.path.root.clientRect;
    var px = event.clientX - clientRect.left;
    var py = event.clientY - clientRect.top;

    splitEdge(item, px, py);
  }
}

/** @private */
var keys =
{
  escape: ["Esc", "Escape", 27],
  del: ["Del", "Delete", 46],
  tab: ["Tab", 9],
  down: ["Down", "ArrowDown", 40],
  up: ["Up", "ArrowUp", 38],
  left: ["Left", "ArrowLeft", 37],
  right: ["Right", "ArrowRight", 39],
  zero: ["0", 48],
  add: ["Add", 107, 187],
  subtract: ["Subtract", 109, 189]
};

/**
  A map of key event handlers.  
  @private
*/
var keymap =
[
  {
    key: keys.tab,
    handler: function(event, root)
    {
      var shift = event.shiftKey;
      var paths = root.paths;

      for(var i = 0, c = paths.length; i < c; ++i)
      {
        if (paths[i].selected)
        {
          if (shift)
          {
            i = i == 0 ? c - 1 : i - 1;
          }
          else if (++i == c)
          {
            i = 0;
          }
          // No more cases

          selectPath(root, paths[i]);

          break;
        }
      }
    }
  },
  {
    key: keys.del,
    handler: function(event, root)
    {
      var paths = root.paths;

      if (root.readonly)
      {
        return false;
      }

      var index;

      for(var i = paths.length; i--;)
      {
        var path = paths[i];

        if (path.selected)
        {
          index = i;
          root.paths.splice(i, 1);
          root.change(ChangeType.Remove, path);
          path.release();
        }
      }

      paths.length && selectPath(root, root.paths[index]);
    }
  },
  {
    key: keys.left,
    handler: function(event, root)
    {
      return keyTransform(
        root,
        event.shiftKey ? { s: 1 / 1.1 } :
          event.ctrlKey ? { angle: -5 } : { dx: -5 });
    }
  },
  {
    key: keys.up,
    handler: function(event, root)
    {
      return keyTransform(
        root,
        event.shiftKey ? { s: 1.1 } : 
          event.ctrlKey ? { angle: -5 } : { dy: -5 });
    }
  },
  {
    key: keys.down,
    handler: function(event, root)
    {
      return keyTransform(
        root,
        event.shiftKey ? { s: 1 / 1.1 } :
          event.ctrlKey ? { angle: 5 } : { dy: 5 });
    }
  },
  {
    key: keys.right,
    handler: function(event, root)
    {
      return keyTransform(
        root,
        event.shiftKey ? { s: 1.1 } :
          event.ctrlKey ? { angle: 5 } : { dx: 5 });
    }
  },
  //{
  //  ctrl: true,
  //  key: keys.zero,
  //  handler: preventDefault
  //},
  //{
  //  ctrl: true,
  //  key: keys.add,
  //  handler: function (event, root)
  //  {
  //    return keyTransform(root, { s: 1.1 });
  //  }
  //},
  //{
  //  ctrl: true,
  //  key: keys.subtract,
  //  handler: function(event, root)
  //  {
  //    return keyTransform(root, { s: 1 / 1.1 });
  //  }
  //}
];

/** @private */
function keyTransform(root, options)
{
  if (root.readonly)
  {
    return false;
  }

  var clientRect = root.clientRect;
  var width = clientRect.width;
  var height = clientRect.height;
  var transforms = [];
  var paths = root.paths;

  for(var i = 0, c = paths.length; i < c; ++i)
  {
    var path = paths[i];

    if (path.selected)
    {
      var transform = new Transform(path);
      var cx = transform.cx;
      var cy = transform.cy;

      if (options.dx)
      {
        cx += options.dx;
      }

      if (options.dy)
      {
        cy += options.dy;
      }

      if ((cx < 0) || (cx > width) || (cy < 0) || (cy > height))
      {
        return;
      }

      transforms.push(transform);
    }
  }

  transforms.forEach(function(transform)
  {
    transform.transform(options);
    root.change(ChangeType.Transform, transform.path);
  });
}

/** @private */
function keyEvent(event, map, self)
{
  var ctrl = event.ctrlKey;
  var shift = event.shiftKey;
  var key = event.key;
  var code = event.keyCode;

  for(var i = 0; i < map.length; ++i)
  {
    var item = map[i];

    if (((item.ctrl !== undefined) && (item.ctrl != ctrl)) ||
      ((item.shift !== undefined) && (item.shift != shift)))
    {
      continue;
    }

    for(var k = 0; k < item.key.length; ++k)
    {
      var value = item.key[k];

      if (typeof value === "string" ? key === value : code === value)
      {
        if (item.handler(event, self) === false)
        {
          continue;
        }

        event.preventDefault();

        return true;
      }
    }
  }

  return false;
}

/** @private */
function selectPath(root, path)
{
  root.paths.forEach(function (item)
  {
    var selected = item === path;

    if (item.selected !== selected)
    {
      item.selected = selected;
      root.change(ChangeType.Select, item);
    }
  });
}

/** @private */
function preventDefault(event) { event.preventDefault(); }

/**
  Creates a class name for a name id.
  @param {string} name A name id.
  @returns {string} a class name.
 */
function classFor(name) { return "st-" + name; }

/** @private */
function selectorFor(name) { return "." + classFor(name); }

/**
  A module representing a shirt.
  @exports selectionTool
 */
var api =
{
  svgns: svgns,
  xlinkns: xlinkns,
  data: data,
  on: on,
  getImageSize: getImageSize,
  getBBox: getBBox,
  scalePath: scalePath,
  classFor: classFor,

  Item: Item,
  Root: Root,
  Path: Path,
  Vertex: Vertex,
  Edge: Edge,
  Transform: Transform
};

return api;

});
