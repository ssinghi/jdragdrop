
# jdragdrop

A JQuery add-on for flexible drag/drop interactions.

This library implements the API defined by ThreeDubMedia in their 
[jquery.event.drag](http://threedubmedia.com/code/event/drag) and
[jquery.event.drop](http://threedubmedia.com/code/event/drop), but
it is a separate implementation that does not share any code (and
is implemented very differently).

## Why?

The drag/drop plugins from ThreeDubMedia have the best API of any
JavaScript drag/drop library I have found.  Benefits are:

 * **event-based approach**: the library only fires events, it does not
   attempt to read or write the DOM directly, which allows for
   greater decoupling.

 * **flexibility**: a wide variety of drag/drop interactions are possible,
   as is illustrated in the demos, without having to put the logic
   for complicated interactions in the library itself.

However, when I tried to use the ThreeDubMedia libraries early in
2012, I found that they didn't work correctly with jQuery 1.7.
When I tried to fix this problem, I discovered that these libraries
used a complicated feature of jQuery known as "special events," and
generally seemed more tightly coupled to jQuery internals than I
wanted.

I decided to try creating a different implementation of ThreeDubMedia's
API that used only public jQuery functionality, in hopes that the
resulting library would be less sensitive to changes in the internals
of jQuery.

## Differences

This library does not use the jQuery "special events" API.  It uses only
public jQuery functionality like `$.on()` and `$.trigger()` to register
and trigger custom drag/drop functionality.

Another major difference is that this library registers far fewer event
handlers on the DOM.  The ThreeDubMedia library registers a set of event
handlers (mousedown, mousemove, mouseup, etc) on *each* element of interest,
and these handlers are registered all the time.  This means that even when
no drag/drop interaction is currently happening, event handlers are firing
and discarding uninteresting events.

This library, on the other hand, only registers a single "mousedown" event
for the whole document.  When the mouse is clicked, it looks for any matching
elements and only installs "mousemove" and "mouseup" handlers for the duration
of the drag/drop interaction.

## Status

Currently the "drag" part of the library supports all the demos in Chrome
(with one exception, see below).  Drop is not yet implemented.

`dragtests/live.html` can lose the drag if you move the mouse too fast;
this should be fixed.

I don't have too much time to devote to maintaining the library, but I'd
love to see any contributions of:

 * Functionality that makes it easier to test against multiple jQuery
   versions.  Maybe all the demos should be embedded into a single html
   page with a drop-down to select your jQuery version?

 * Anything that can automate the testing (seems like this should be
   possible by manually triggering the mouse events and verifying that
   callbacks are called correctly).

 * Any fixes for modern browsers, touchscreen functionality, etc!

## Copyright / License

Copyright (c) 2012 Google, Inc.
Released under Apache 2.0.
