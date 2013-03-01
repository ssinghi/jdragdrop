/**
 * @fileoverview Drag plugin, modeled after jquery.event.drag.
 * @author jhaberman@gmail.com (Josh Haberman)
 */

(function($) {

/**
 * Filter the given array in-place.  Optimized for the case where removing
 * elements is rare.
 * @param {Array} arr The array to modify in-place.
 * @param {function} func A function that is called once for each array
 *     element.  Should return a truthy value to keep the given element.
 */
function filter(arr, func) {
  for (var i = 0; i < arr.length; ) {
    if (func(arr[i]))
      i++;
    else
      arr = arr.splice(i, 1);
  }
  return arr;
}

function dontStart() { return false; }

var props = ["target", "pageX", "pageY", "which", "metaKey"];

/**
 * Gets a handler of the given type.  This is our one bit of slight jQuery
 * encapsulation violation (I don't believe that data("events") is *officially*
 * documented, though John Resig mentions it in this jQuery slide deck:
 * http://ejohn.org/apps/workshop/adv-talk/
 * @param {HTMLElement} targetElem The logical element we are getting a handler
 *     for.
 * @param {HTMLElement} handlerElem The physical element we are getting a
 *     handler for.  If the caller is looking for a delegated handler, this
 *     will be a parent of targetElem.  If a delegated handler is found,
 *     the returned targetElem may be a parent of targetElem.
 * @param {string} type The event type to look for.
 */
function getHandler(targetElem, handlerElem, type) {
  var events = $.data(handlerElem, "events") || {}
  if (!events[type]) return;
  var ev = events[type][0];
  var elem = ev.selector ?
      $(targetElem).closest(ev.selector || "", handlerElem).get()[0] : handlerElem;
  if (!elem) return;
  return {"targetElem": elem, "handlerElem": handlerElem, "opts": ev.data};
}

/**
 * Finds the closest element that has at least one drag handler and returns
 * it, along with a set of options which is merged from *all* drag handlers
 * on that element.
 * @param {HTMLElement} elem The element to search from.  The returned element
 *     will be up the DOM tree from this one.
 */
function getClosestHandler(elem) {
  // Look for an element to which a drag handler is physically bound.
  var handlerElem = elem;
  var opts = {
    which: 1,
    distance: 0,
    not: ':input',
    handle: null,
    relative: false,
    drop: true,
    click: false,
  };
  while (handlerElem) {
    var handler;
    $.each(["dragstart", "drag", "dragend"], function(i, type) {
      var typeHandler = getHandler(elem, handlerElem, type);
      if (typeHandler) $.extend(opts, typeHandler.opts);
      handler = handler || typeHandler;
    });
    if (handler) {
      handler.opts = opts;
      return handler;
    }
    handlerElem = handlerElem.parentNode;
  }
}

/**
 * Class that represents the data object of properties passed as the second
 * parameter to the drag handlers.  jquery.event.drag calls this a "callback,"
 * but I find this terminology highly unusual, so I just call it Properties.
 *
 * @param {Event} event The "mousedown" event that started this interaction.
 * @param {Object} handler A return value from getHandler() indicating the
 *     handler elements and options.
 * @param {HTMLElement} drag The element that we called draginit on.
 * @constructor.
 */
function Properties(event, handler, origHandler) {
  var xy = $(handler.targetElem)[handler.opts.relative ? "position" : "offset"]() ||
      {top: 0, left: 0};
  this.drag = origHandler.targetElem;
  this.target = handler.targetElem;
  this.handlerElem = handler.handlerElem;
  this.startX = evX(event);
  this.startY = evY(event);
  this.originalX = xy.left;
  this.originalY = xy.top;
}

function evX(e) { return e.pageX || e.originalEvent.pageX; }
function evY(e) { return e.pageY || e.originalEvent.pageY; }

/**
 * Updates the properties to reflect a new mouse position.
 *
 * @param {Event} event The event that indicates a new mouse position.
 */
Properties.prototype.update = function(event) {
  if (event.originalEvent.type != 'touchend') {
    this.deltaX = evX(event) - this.startX;
    this.deltaY = evY(event) - this.startY;
  }
  this.offsetX = this.originalX + this.deltaX;
  this.offsetY = this.originalY + this.deltaY;
}

/**
 * Triggers a drag event on the element represented by these properties.
 *
 * @param {Event} srcEvent The underlying mouse event.
 * @param {string} type The type of drag event to trigger.
 */
Properties.prototype.trigger = function(srcEvent, type) {
  this.update(srcEvent);
  var event = $.Event(type);
  $.each(props, function(i, prop) { event[prop] = srcEvent[prop]; })
  //if ($(event.target).closest(this.target).length == 0)
  //  event.target = this.target;
  event.currentTarget = this.target
  return $(this.handlerElem).triggerHandler(event, this);
}

Properties.prototype.distance = function() {
  return Math.pow(Math.pow(this.deltaX, 2) + Math.pow(this.deltaY, 2), 0.5);
}

/**
 * Class that represents a single element that is being dragged.  Each element
 * goes through the life-cycle of dragstart -> drag -> dragend.
 */
function Element(event, handler, origHandler) {
  this.properties = new Properties(event, handler, origHandler);
}

Element.prototype.dragstart = function(event) {
  var ret = this.properties.trigger(event, "dragstart");
  if (ret === false)
    return this.abort(event);
  this.properties.proxy = $(ret || this.properties.drag);
  return true;
}

Element.prototype.drag = function(event) {
  return this.properties.trigger(event, "drag") === false ? this.abort(event) : true;
}

Element.prototype.dragend = function(event) {
  this.properties.trigger(event, "dragend");
}

Element.prototype.abort = function() {
  this.dragend();
  return false;
}

/**
 * Class that represents an entire drag interaction.  A drag interaction
 * initializes itself by calling a draginit handler, then has a set of dragged
 * elements each of which has a set of callbacks.
 * @param {Event} event The underlying mousedown event that triggered the drag.
 * @param {Object} handler The handler object (returned by getHandler()) that
 *     indicates what element's handlers should be used for draginit.
 * @constructor.
 */
function Drag(event, handler) {
  this.properties = new Properties(event, handler, handler);
  this.opts = handler.opts;

  // Call user's draginit handler, passing the small subset of properties that
  // are defined at this point.
  var ret = this.properties.trigger(event, "draginit")
  if (ret === false) return;  // User cancelled.

  this.interactions = $(ret || [handler.targetElem]).get().map(function(dragElem) {
    var elemHandler = getClosestHandler(dragElem);
    return handler ? new Element(event, elemHandler, handler) : null;
  });
  $(document).on("mousemove.drag", this, function(e) { e.data.mouseMove(e); });
  $(document).on("mouseup.drag", this, function(e) { e.data.mouseUp(e); });
  $(document).on("touchmove.drag", this, function(e) { e.data.mouseMove(e); });
  $(document).on("touchend.drag", this, function(e) { e.data.mouseUp(e); });

  // Prevent image dragging in IE.
  if (this.attachEvent)
    this.attachEvent("ondragstart", dontStart);
  this.enableTextSelect(false);
}

Drag.prototype.finish = function() {
  $(document).off(".drag");

  // Restore image dragging in IE.
  if (this.detachEvent)
    this.detachEvent("ondragstart", dontStart);
}

Drag.prototype.enableTextSelect = function(enable) {
  $(document)[enable ? "unbind" : "bind"]("selectstart", dontStart)
    .attr("unselectable", enable ? "off" : "on")
    .css("MozUserSelect", enable ? "" : "none");
}

Drag.prototype.mouseMove = function(event) {
  this.properties.update(event);
  if (!this.dragging && this.properties.distance(event) >= this.opts.distance) {
    filter(this.interactions, function(ia) { return ia.dragstart(event); });
    this.dragging = true;
  }
  if (this.dragging)
    filter(this.interactions, function(ia) { return ia.drag(event); });
  if (this.interactions.length == 0)
    this.finish();
}

Drag.prototype.mouseUp = function(event) {
  $.each(this.interactions, function(i, ia) { ia.dragend(event); });
  this.enableTextSelect(true);
  if (this.dragging && this.opts.click == false) {
    $(this.properties.target).one("click", function(event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    });
    // The handler was just appended to the list, but we need it to run first
    // so it can prevent any other handlers from running.
    var events = $.data(this.properties.target, "events")["click"];
    events.splice(0, 0, events.pop());
  }
  this.finish();
}

/**
 * Handler for "mousedown" events that is always registered for the entire
 * document.
 */
$(document).on("mousedown.jdrag", function(event) {
  // Initialize options with defaults.
  var opts;
  var handler = getClosestHandler(event.target);
  if (!handler) return;
  opts = handler.opts;

  // Ensure that the event fulfills the draginit criteria.
  if (opts.which > 0 && event.which != opts.which) return;
  if (opts.not && $(opts.not, handler.target).is(event.target)) return;
  if (opts.handle && $(event.target).closest(opts.handle, event.currentTarget).length == 0)
    return;

  new Drag(event, handler);
});

/**
 * Handler for "touchstart" events that is always registered for the entire
 * document.
 */
$(document).on("touchstart.jdrag", function(event) {
  // Initialize options with defaults.
  var opts;
  var handler = getClosestHandler(event.target);
  if (!handler) return;
  opts = handler.opts;

  // Ensure that the event fulfills the draginit criteria.
  if (opts.not && $(opts.not, handler.target).is(event.target)) return;
  if (opts.handle && $(event.target).closest(opts.handle, event.currentTarget).length == 0)
    return;

  new Drag(event, handler);
  return false;
});

/**
 * Variants are:
 * - drag()
 * - drag(type)
 * - drag(handler, opts)
 * - drag(type, handler, opts)
 */
$.fn.drag = function(arg1, arg2, opts) {
  var type = typeof arg1 == "string" ? arg1 : "drag";
  var fn = $.isFunction(arg1) ? arg1 : $.isFunction(arg2) ? arg2 : null;
  if (type.indexOf("drag") !== 0)
    type = "drag" + type;
  opts = (arg1 == fn ? arg2 : opts) || {};
  return fn ? this.on(type, opts, fn) : this.trigger(type);
}

})(jQuery);
