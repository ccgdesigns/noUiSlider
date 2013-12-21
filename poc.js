(function( $ ){

	'use strict';

	var
	// Cache the document selector;
	 doc = $(document)
	// Namespace for binding and unbinding slider events;
	,namespace = '.nui'
	// Copy of the current value function;
	,$val = $.fn.val
	// Determine the events to bind. IE11 implements pointerEvents without
	// a prefix, which breaks compatibility with the IE10 implementation.
	,actions = window.navigator.pointerEnabled ? {
		 start: 'pointerdown'
		,move: 'pointermove'
		,end: 'pointerup'
	} : window.navigator.msPointerEnabled ? {
		 start: 'MSPointerDown'
		,move: 'MSPointerMove'
		,end: 'MSPointerUp'
	} : {
		 start: 'mousedown touchstart'
		,move: 'mousemove touchmove'
		,end: 'mouseup touchend'
	}
	// Re-usable list of classes;
	,Classes = [
/*  0 */  'noUi-target'
/*  1 */ ,'noUi-base'
/*  2 */ ,'noUi-origin'
/*  3 */ ,'noUi-handle'
/*  4 */ ,'noUi-horizontal'
/*  5 */ ,'noUi-vertical'
/*  6 */ ,'noUi-background'
/*  7 */ ,'noUi-connect'
/*  8 */ ,'noUi-ltr'
/*  9 */ ,'noUi-rtl'
/* 10 */ ,'noUi-dragable'
/* 11 */ ,'noUi-block'
/* 12 */ ,'noUi-state-drag'
/* 13 */ ,'noUi-state-blocked'
/* 14 */ ,'noUi-state-tap'
/* 15 */ ,'noUi-active'
/* 16 */ ,'noUi-extended'
/* 17 */ ,'noUi-stacking'
	]
	,Formatting = [
/*  0 */  'decimals'
/*  1 */ ,'mark'
/*  2 */ ,'thousand'
/*  3 */ ,'prefix'
/*  4 */ ,'postfix'
/*  5 */ ,'encoder'
/*  6 */ ,'decoder'
/*  7 */ ,'negative'
/*  8 */ ,'negativeBefore'
	]
	,FormatDefaults = [
/*  0 */  2
/*  1 */ ,'.'
/*  2 */ ,','
/*  3 */ ,''
/*  4 */ ,''
/*  5 */ ,function(a){ return a; }
/*  6 */ ,function(a){ return a; }
/*  7 */ ,'-'
/*  8 */ ,''
	];

// General helpers

	// Limits a value to 0 - 100
	function limit ( a ) {
		return Math.max(Math.min(a, 100), 0);
	}

	// Round a value to the closest 'to'.
	function closest ( value, to ){
		return Math.round(value / to) * to;
	}

	// Dynamically anonymize formatting options.
	function anonymize ( z ) {
		var y = [];
		$(Formatting).each(function(i,val){
			y[i] = z[val];
		});
		return y;
	}

	// Throw an error if formatting options are incompatible.
	function throwEqualError(F,a,b){
		if ( (F[a] || F[b]) && (F[a] === F[b]) ) {
			throw new RangeError('Link: '+Formatting[a]+' can\'t match '+Formatting[b]+'.');
		}
	}

	// Determine the size of a sub-range in relation to a full range.
	function subRangeRatio ( pa, pb ) {
		return (100 / (pb - pa));
	}


// Type validation

	// Test in an object is an instance of jQuery or Zepto.
	function isInstance ( a ) {
		return a instanceof $ || ( $.zepto && $.zepto.isZ(a) );
	}

	// Checks whether a value is numerical.
	function isNumeric ( a ) {
		return !isNaN( parseFloat( a ) ) && isFinite( a );
	}

	// Wraps a variable as an array, if it isn't one yet.
	function asArray ( a ) {
		return $.isArray(a) ? a : [a];
	}


// Class handling

	// Sets a class and removes it after [duration] ms.
	function addClassFor ( element, className, duration ) {
		element.addClass(className);
		setTimeout(function(){
			element.removeClass(className);
		}, duration);
	}

	// Tests if element has a class, adds it if not. Returns original state.
	function getsClass ( element, className ) {

		var has = element.hasClass(className);

		if ( !has ) {
			element.addClass( className );
		}

		return has;
	}


// Value calculation

	// (percentage) How many percent is this value of this range?
	function fromPercentage ( range, value ) {
		return (value * 100) / ( range[1] - range[0] );
	}

	// (percentage) Where is this value on this range?
	function toPercentage ( range, value ) {
		return fromPercentage( range, range[0] < 0 ?
			value + Math.abs(range[0]) :
				value - range[0] );
	}

	// (value) How much is this percentage on this range?
	function isPercentage ( range, value ) {
		return ((value * ( range[1] - range[0] )) / 100) + range[0];
	}

	// (percentage)
	function toStepping ( options, value ) {

		if ( !options.stepping ) {
			return toPercentage( options.range, value );
		}

		var j = 0;

		if ( value === options.range[1] ){
			return 100;
		}

		while ( value >= options.steps[++j] ){}

		var va = options.steps[j-1],
			vb = options.steps[j],
			pa = options.stepping[j-1],
			pb = options.stepping[j];

		return pa + (toPercentage([va, vb], value) / subRangeRatio (pa, pb));
	}

	// (value)
	function fromStepping ( options, value ) {

		if ( !options.stepping ) {
			return isPercentage( options.range, value );
		}

		var j = 0;

		// There is no range group that fits 100
		if ( value === 100 ){
			return options.range[1];
		}

		while ( value >= options.stepping[++j] ){}

		var va = options.steps[j-1],
			vb = options.steps[j],
			pa = options.stepping[j-1],
			pb = options.stepping[j];

		return isPercentage([va, vb], (value - pa) * subRangeRatio (pa, pb));
	}

	// (percentage) Get the step that applies at a certain value.
	function getStep ( options, value ){

		var step;

		var j = 0;

		if ( options.stepping ) {

			while ( value >= options.stepping[++j] ){} // why >= ?

			if ( options.step ) {
				return options.stepping[j-1];
			}

			// todo. This doesn't work properly. E.g. 10% -> 500
			step = options.snaps[j-1];
			
			console.log('------------');
			console.log(step, j, options.snaps, value );
			console.log('------------');

		} else {

			step = options.step;
		}

		if ( step ) {
			return closest( value, step );
		}

		return value;
	}


// Event handling

	// Provide a clean event with standardized offset values.
	function fixEvent ( e ) {

		// Prevent scrolling and panning on touch events, while
		// attempting to slide. The tap event also depends on this.
		e.preventDefault();

		// Filter the event to register the type, which can be
		// touch, mouse or pointer. Offset changes need to be
		// made on an event specific basis.
		var  touch = e.type.indexOf('touch') === 0
			,mouse = e.type.indexOf('mouse') === 0
			,pointer = e.type.indexOf('pointer') === 0
			,x,y, event = e;

		// IE10 implemented pointer events with a prefix;
		if ( e.type.indexOf('MSPointer') === 0 ) {
			pointer = true;
		}

		// Get the originalEvent, if the event has been wrapped
		// by jQuery. Zepto doesn't wrap the event.
		if ( e.originalEvent ) {
			e = e.originalEvent;
		}

		if ( touch ) {
			// noUiSlider supports one movement at a time,
			// so we can select the first 'changedTouch'.
			x = e.changedTouches[0].pageX;
			y = e.changedTouches[0].pageY;
		}

		if ( mouse || pointer ) {

			// Polyfill the pageXOffset and pageYOffset
			// variables for IE7 and IE8;
			if( !pointer && window.pageXOffset === undefined ){
				window.pageXOffset = document.documentElement.scrollLeft;
				window.pageYOffset = document.documentElement.scrollTop;
			}

			x = e.clientX + window.pageXOffset;
			y = e.clientY + window.pageYOffset;
		}

		event.points = [x, y];
		event.cursor = mouse;

		return event;
	}


// Input validation

	// Test all developer settings and parse to assumption-safe values.
	function test ( options, sliders ){

	/*	Every input option is tested and parsed. This'll prevent
		endless validation in internal methods. These tests are
		structured with an item for every option available. An
		option can be marked as required by setting the 'r' flag.
		The testing function is provided with three arguments:
			- The provided value for the option;
			- A reference to the options object;
			- The name for the option;

		The testing function returns false when an error is detected,
		or true when everything is OK. It can also modify the option
		object, to make sure all values can be correctly looped elsewhere. */

		function values ( a ) {

			if ( a.length !== 2 ){
				return false;
			}

			// Convert the array to floats
			a = [ parseFloat(a[0]), parseFloat(a[1]) ];

			// Test if all values are numerical
			if( !isNumeric(a[0]) || !isNumeric(a[1]) ){
				return false;
			}

			// The lowest value must really be the lowest value.
			if( a[1] < a[0] ){
				return false;
			}

			return a;
		}

		var parsed = {}, tests = {
			 'handles': {
				 r: true
				,t: function( q ){
					parsed.handles = q = parseInt(q, 10);
					return ( q === 1 || q === 2 );
				}
			}
			,'range': {
				 r: true
				,t: function( q ){

					parsed.range = values(q);

					// The values can't be identical.
					return parsed.range && parsed.range[0] !== parsed.range[1];
				}
			 }
			,'start': {
				 r: true
				,t: function( q ){
					if ( parsed.handles === 1 ){
						if( $.isArray(q) ){
							q = q[0];
						}
						q = parseFloat(q);
						parsed.start = [q];
						return isNumeric(q);
					}
					parsed.start = values(q);
					return !!parsed.start;
				}
			}
			,'connect': {
				 r: true
				,t: function( q ){

					if ( q === 'lower' && parsed.handles === 1 ) {
						parsed.connect = 1;
					} else if ( q === 'upper' && parsed.handles === 1 ) {
						parsed.connect = 2;
					} else if ( q === true && parsed.handles === 2 ) {
						parsed.connect = 3;
					} else if ( q === false ) {
						parsed.connect = 0;
					} else {
						return false;
					}

					return true;
				}
			}
			,'orientation': {
				 t: function( q ){
					switch ( q ){
						case 'horizontal':
							parsed.ort = 0;
							break;
						case 'vertical':
							parsed.ort = 1;
							break;
						default: return false;
					}
					return true;
				}
			}
			,'margin': {
				 r: true
				,t: function( q ){
					q = parseFloat(q);
					parsed.margin = fromPercentage(parsed.range, q);
					return isNumeric(q);
				}
			}
			,'direction': {
				 r: true
				,t: function( q ){

					switch ( q ) {
						case 'ltr': parsed.dir = 0;
							break;
						case 'rtl': parsed.dir = 1;
							// Invert connection for RTL sliders;
							parsed.connection = [0,2,1,3][parsed.connect];
							break;
						default:
							return false;
					}

					return true;
				}
			}
			,'behaviour': {
				 r: true
				,t: function( q ){

					parsed.events = {
						 tap: q.indexOf('tap') >= 0
						,extend: q.indexOf('extend') >= 0
						,drag: q.indexOf('drag') >= 0
						,fixed: q.indexOf('fixed') >= 0
					};

					return true;
				}
			}
			,'stepping': {
				 t: function( q ){

					var correct = true, i = 0;

					// todo rename
					parsed.stepping = [ 0 ];
					parsed.steps = [ parsed.range[0] ];
					parsed.snaps = [ false ];

					$.each(q, function( percentage, b ){ // todo rename

						percentage = parseFloat( percentage );

						// Check for correct input.
						if( !isNumeric( percentage ) || !$.isArray( b ) ) {
							correct = false;
							return false;
						}

						var value = parseFloat(b[0]),
							step = parseFloat(b[1]);

						// For 0%, only stepping can be set.
						if ( !i && !percentage ){
							parsed.snaps[i++] = step;
							return true;
						}

						// Ignore any values for 100%.
						if ( percentage === 100 ) {
							return false;
						}

						parsed.stepping[i] = percentage;
						parsed.steps[i] = value;

						// NaN will evaluate to false too, but to keep
						// logging clear, set step explicitly.
						parsed.snaps[i] = isNaN(step) ? false : step;

						i++;
					});

					// The final value matches range end.
					// There is no sense in stepping at 100%.
					parsed.stepping[i] = 100;
					parsed.steps[i] = parsed.range[1];
					parsed.snaps[i] = false;

					$.each(parsed.snaps, function(i,n){

						// Ignore 'false' stepping.
						if ( !n ) {
							return true;
						}

						// Factor to range ratio
						parsed.snaps[i] = fromPercentage([
							 parsed.steps[i]
							,parsed.steps[i+1]
						], n) / subRangeRatio (
							parsed.stepping[i],
							parsed.stepping[i+1] );
					});

					// todo remove debug
					console.log(parsed.steps);
					console.log(parsed.stepping);
					console.log(parsed.snaps);

					return correct;
				}
			}
			,'step': {
				 t: function( q ){

					if ( parsed.stepping ) {
						parsed.step = true;
						return q === true;
					}

					q = parseFloat(q);
					parsed.step = fromPercentage ( parsed.range, q );
					return isNumeric(q);
				}
			}
			,'serialization': {
				 r: true
				,t: function( q, sliders ){

					var status = true, y = anonymize( q['format'] || {} );

					parsed.ser = [ q['lower'], q['upper'] ];

					$.each( parsed.ser, function( i, a ){

						// Check if the provided option is an array.
						if ( !$.isArray(a) ) {
							status = false;
							return false;
						}

						$.each(a, function(){

							// Check if entry is a Link.
							if ( !(this instanceof Link) ) {
								status = false;
								return false;
							}

							// Assign other properties.
							this.N = i;
							this.obj = sliders;
							this.scope = this.scope || sliders;

							// Run internal validator.
							this.validate( y );
						});
					});

					parsed.formatting = y;

					if ( parsed.dir ) {
						parsed.ser.reverse();
					}

					return status;
				}
			}
		};

		// Set defaults where applicable;
		options = $.extend({
			 'handles': 2
			,'margin': 0
			,'connect': false
			,'direction': 'ltr'
			,'behaviour': 'tap'
			,'orientation': 'horizontal'
		}, options);

		// Make sure the test for serialization runs.
		options['serialization'] = $.extend({
			 'lower': []
			,'upper': []
			,'format': {}
		}, options['serialization']);

		// Run all options through a testing mechanism to ensure correct
		// input. It should be noted that options might get modified to
		// be handled properly. E.g. wrapping integers in arrays.
		$.each( tests, function( name, test ){

			if ( options[name] === undefined ) {
				if ( !test.r ) {
					return true;
				}
			} else if ( test.t( options[name], sliders ) ) {
				return true;
			}

			// For debugging purposes it might be very useful to know
			// what option caused the trouble. Since throwing an error
			// will prevent further script execution, log the error
			// first. Test for console, as it might not be available.
			if( window.console && console.log && console.group ){
				console.group( 'Invalid noUiSlider initialisation:' );
				console.log( 'Option:\t', name );
				console.log( 'Value:\t', options[name] );
				console.log( 'Slider(s):\t', sliders );
				console.groupEnd();
			}

			throw new RangeError('noUiSlider');
		});

		// Pre-define the styles.
		parsed.style = parsed.ort ? 'top' : 'left';

		return parsed;
	}


// Serialization target

/** @constructor */
	function Link( target, method, options ){

		// Make sure Link isn't called as a function, in which case
		// the 'this' scope would be the window.
		if ( !(this instanceof Link) ) {
			throw new Error('Can\'t use Link as a function. Use the \'new\' keyword.');
		}

		// Returns null array.
		function at(a,b,c){
			return [c?a:b, c?b:a];
		}

		// Write all options to this object.
		this.formatting = anonymize( options || {} );

		// Set an empty $ object so the destroy function won't have
		// to handle .isFunction objects differently.
		this.target = $([]);
		this.method = method;

		// Set the function calling scope.
		if ( typeof method === 'function' ) {
			this.scope = target;
			this.isFunction = true;
		}

		switch ( typeof target ) {

		// If target is a string, a new hidden input will be created.
		case 'string':

			if ( !target.indexOf('-tooltip-') ) {

				// Set default tooltip html.
				target = target.replace('-tooltip-', '') || '<div/>';

				// By default, use the 'html' method.
				if ( !method ) {
					this.method = 'html';
				}

				// Use jQuery to create the element
				this.el = $(target)[0];

				return;
			}

			// If the string doesn't begin with '-', which is reserved,
			// add a new hidden input.
			if ( target.indexOf('-') ) {

				this.method = 'val';

				this.el = document.createElement('input');
				this.el.name = target;
				this.el.type = 'hidden';

				return;
			}

		case 'function':

			this.method = target;
			this.isFunction = true;

			return;

		case isInstance(target) && 'object':

			this.target = target;

			// Store the selected method, if one is provided.
			if ( method ) {
				return;
			}

			// Default to .val if this is an input element.
			if ( target.is('input, select, textarea') ) {

				this.method = 'val';

				// Set the slider to a new value on change.
				this.target.on('change', $.proxy(function( e ){
						this.obj.val(at(
							null, $(e.target).val(), this.N
						), false, this);
					}, this));

				return;
			}

			// Otherwise, use .html, which is an arbitrary choice.
			this.method = 'html';

			return;
		}

		throw new RangeError('Invalid Link');
	}

	// Checks all settings on this object for validity or sets defaults.
	Link.prototype.validate = function ( inherit ) {

		var F = this.formatting;

		inherit = inherit || [];

		$.each(F, function(i, val){

			var type = typeof FormatDefaults[i];

			F[i] =	typeof val === type ?
					val : typeof inherit[i] === type ?
						inherit[i] : FormatDefaults[i];
		});

		// Support for up to 7 decimals. More can't be guaranteed.
		if ( F[0] > 7 ) {
			F[0] = 7;
		} else if (!(F[0] >= 0 && F[0] <= 7)) {
			F[0] = FormatDefaults[0];
		}

		// Throw errors for combinations that can't be detected.
		throwEqualError(F,1,2);
		throwEqualError(F,3,7);
		throwEqualError(F,3,8);

		this.formatting = F;

		console.log( this.formatting );
		return this;
	};

	// Provides external items with the slider value.
	Link.prototype.write = function ( options, value, handle, slider ) {

		// Convert the value to the slider stepping/range.
		value = fromStepping( options, value );

		// Format values for display.
		value = this.format( value );

		// Store the numerical value.
		this.saved = value;

		// Branch between serialization to a function or an object.
		if ( this.isFunction ) {
			this.method.call( this.scope, value, handle, slider );
		} else {
			this.target[ this.method ]( value, handle, slider );
		}
	};

	// Parses slider value to user defined display.
	Link.prototype.format = function ( number ) {

		function reverse ( a ) {
			return a.split('').reverse().join('');
		}

		number = this.formatting[5]( number );

		var negative = '', preNegative = '', base = '', mark = '';

		if ( number < 0 ) {
			negative = this.formatting[7];
			preNegative = this.formatting[8];
		}

		// Round to proper decimal count
		number = Math.abs(number).toFixed( this.formatting[0] ).toString();
		number = number.split('.');

		// Rounding away decimals might cause a value of -0
		// when using very small ranges. Remove those cases.
		if ( parseFloat(number) === 0 ) {
			number[0] = '0';
		}

		// Group numbers in sets of three.
		if ( this.formatting[2] ) {
			base = reverse(number[0]).match(/.{1,3}/g);
			base = reverse(base.join(reverse( this.formatting[2] )));
		}

		// Ignore the decimal separator if decimals are set to 0.
		if ( this.formatting[1] && number.length > 1 ) {
			mark = this.formatting[1] + number[1];
		}

		// Return the finalized formatted number.
		return preNegative +
			this.formatting[3] +
			negative +
			base +
			mark +
			this.formatting[4];
	};

	// Converts a formatted value back to a real number.
	Link.prototype.valueOf = function ( input ) {

		var isNegative;

		function esc(s){
			return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
		}

		// The set request might want to ignore this handle.
		// Test for 'undefined' too, as a two-handle slider
		// can still be set with an integer.
		if( input === null || input === undefined ) {
			return false;
		}

		// Remove formatting and set period for float parsing.
		input = input.toString();

		// Replace the preNegative indicator.
		isNegative = input.replace(new RegExp('^' + esc( this.formatting[8] )), '');

		// Check if the value changed by removing the negativeBefore symbol.
		if( input !== isNegative ) {
			input = isNegative;
			isNegative = '-';
		} else {
			isNegative = '';
		}

		// If prefix is set and the number is actually prefixed.
		input = input.replace(new RegExp('^' + esc( this.formatting[3] )), '');

		// Only replace if a negative sign is set.
		if ( this.formatting[7] ) {

			// Reset isNegative to prevent double '-' insertion.
			isNegative = '';

			// Reset the negative sign to '-'
			input = input.replace(new RegExp('^' + esc( this.formatting[7] )), '-');
		}

		// If postfix is set and the number is postfixed.
		input = input.replace(new RegExp(esc( this.formatting[4] ) + '$'), '')
		// Remove the separator every three digits.
			.replace(new RegExp(esc( this.formatting[2] ), 'g'), '')
		// Set the decimal separator back to period.
			.replace(this.formatting[1], '.');

		// Run the user defined decoder. Returns input by default.
		input = this.formatting[6]( parseFloat( isNegative + input ) );

		// Ignore invalid input
		if (isNaN( input )) {
			return false;
		}

		return input;
	};

	// Append a hidden input element.
	Link.prototype.append = function ( element ) {
		return new Link( $(this.el).clone().appendTo(element)
			,this.method ).validate( this.formatting );
	};


// DOM additions

	// Append a handle to the base.
	function addHandle ( options, index ) {

		var handle = $('<div><div/></div>').addClass( Classes[2] ),
			additions = [ '-lower', '-upper' ];

		if ( options.dir ) {
			additions.reverse();
		}

		handle.children().addClass(Classes[3] +" "+ Classes[3]+additions[index]);

		return handle;
	}

	// Initialize a single slider.
	function addSlider ( options ) {

		/*jshint validthis: true */

		var base = $('<div/>').appendTo( $(this) ).addClass( Classes[1] ),
			i, links = [], handles = [];

		// Apply classes and data to the target.
		$(this).addClass([
			Classes[0]
		   ,Classes[8 + options.direction]
		   ,Classes[4 + options.ort] ].join(' '));

		// Append handles.
		for (i = 0; i < options.handles; i++ ) {

			// Keep a list of all added handles.
			handles.push( addHandle( options, i ).appendTo(base) );

			// todo move this
			// Copy the links into a new array, instead of modifying
			// the 'options.ser' list. This allows replacement of the invalid
			// '.el' Links, while the others are still passed by reference.
			links[i] = [ new Link( function(){}, false ).validate( options.formatting ) ];

			// Append any hidden input elements.
			$.each( options.ser[i], function(){
				links[i].push( this.el ?
								this.append( handles[i].children() ) :
								this );
			});
		}

		// Apply the required connection classes to the elements
		// that need them. Some classes are made up for several
		// segments listed in the class list, to allow easy
		// renaming and provide a minor compression benefit.
		switch ( options.connect ) {
			case 1:	$(this).addClass( Classes[7] );
					handles[0].addClass( Classes[6] );
					break;
			case 3: handles[1].addClass( Classes[6] );
					/* falls through */
			case 2: handles[0].addClass( Classes[7] );
					/* falls through */
			case 0: $(this).addClass(Classes[6]);
					break;
		}

		return {
			 base: base
			,handles: handles
			,serialization: links
		};
	}


// Slider scope

function closure ( target, options, originalOptions ){

// Internal variables

	var Memory = {
		 target: $(target)
		,locations: [-1, -1]
		,baseSize: function(){
			return this.base[['width', 'height'][options.ort]]();
		}
	};


// Handle placement

	// Test suggested values and apply margin, step.
	function setHandle ( handle, to, delimit ) {

		var n = handle[0] !== Memory.handles[0][0] ? 1 : 0,
			lower = Memory.locations[0] + options.margin,
			upper = Memory.locations[1] - options.margin;

		// Don't delimit range dragging.
		if ( delimit && Memory.handles.length > 1 ) {
			to = n ? Math.max( to, lower ) : Math.min( to, upper );
		}

		// Handle the step option.
		if ( to < 100 ){
			to = getStep(options, to);
		}

		// Limit to 0/100 for .val input, trim anything beyond 7 digits, as
		// JavaScript has some issues in its floating point implementation.
		to = limit(parseFloat(to.toFixed(7)));

		// Return falsy if handle can't move. False for 0 or 100 limit,
		// '0' for limiting by another handle.
		if ( to === Memory.locations[n] ) {
			if ( Memory.handles.length === 1 ) {
				return false;
			}
			return ( to === lower || to === upper ) ? 0 : false;
		}

		// Set the handle to the new position.
		handle.css( options.style, to + '%' );

		// Force proper handle stacking
		if ( handle.is(':first-child') ) {
			handle.toggleClass(Classes[17], to > 50 );
		}

		// Update memory locations.
		Memory.locations[n] = to;

		// Remove blocked state, as the handle could move.
		Memory.target.removeClass(Classes[11]);

		// Invert the value if this is a right-to-left slider.
		if ( options.dir ) {
			to = 100 - to;
		}

		// Write values to serialization Links.
		// Convert the value to the correct relative representation.
		$(Memory.serialization[n]).each(function(){
			this.write( options, to, handle.children(), Memory.target );
		});

		return true;
	}

	// Delimit proposed values for handle positions.
	function getPositions ( a, b, delimit ) {

		// Add movement to current position.
		var c = a + b[0], d = a + b[1];

		// Only alter the other position on drag,
		// not on standard sliding.
		if ( delimit ) {
			if ( c < 0 ) {
				d += Math.abs(c);
			}
			if ( d > 100 ) {
				c -= ( d - 100 );
			}

			// Limit values to 0 and 100.
			return [limit(c), limit(d)];
		}

		return [c,d];
	}

	// Handles movement by tapping.
	function jump ( handle, to ) {

		// Flag the slider as it is now in a transitional state.
		// Transition takes 300 ms, so re-enable the slider afterwards.
		addClassFor( Memory.target, Classes[14], 300 );

		// Move the handle to the new position.
		setHandle( handle, to );

		Memory.target
			.trigger('slide')
			.trigger('set')
			.trigger('change');
	}


// Events

	// Handler for attaching events trough a proxy
	function attach ( events, element, callback, data ) {

		// Add the noUiSlider namespace to all events.
		events = events.replace( /\s/g, namespace + ' ' ) + namespace;

		// Bind a closure on the target.
		return element.on( events, function( e ){

			// jQuery and Zepto handle unset attributes differently.
			var disabled = Memory.target.attr('disabled');
				disabled = !( disabled === undefined || disabled === null );

			// Test if there is anything that should prevent an event
			// from being handled, such as a disabled state or an active
			// 'tap' transition.
			if( Memory.target.hasClass( Classes[14] ) || disabled ) {
				return false;
			}

			e = fixEvent(e);
			e.calcPoint = e.points[ options.ort ];

			// Call the event handler with the event [ and additional data ].
			callback ( e, data );
		});
	}

	// Handle movement on document for handle and range drag.
	function move ( event, data ) {

		var handles = data.handles || Memory.handles, positions, state = false,
			proposal = ((event.calcPoint - data.start) * 100) / Memory.baseSize(),
			h = handles[0][0] !== Memory.handles[0][0] ? 1 : 0;

		// Calculate relative positions for the handles.
		positions = getPositions( proposal, data.positions, handles.length > 1);

		state = setHandle ( handles[0], positions[h], handles.length === 1 );

		if ( handles.length > 1 ) {
			state = setHandle ( handles[1], positions[h?0:1], false ) || state;
		}

		// If no handles where set
		if ( !state ) {

			if ( !getsClass( Memory.target, Classes[11] ) ) {
				return;
			}

			// The visual effects should only be applied when
			// the margin option is set, and when the margin
			// is the cause for the blocking.
			if ( options.margin && state === 0 ) {
				addClassFor( Memory.target, Classes[13], 450 );
			}

			// Fire callback on unsuccessful handle movement.
			Memory.target.trigger('block');

		} else {

			// Fire the 'slide' event if the handle moved.
			Memory.target.trigger('slide');
		}
	}

	// Unbind move events on document, call callbacks.
	function end ( event ) {

		// The handle is no longer active, so remove the class.

		$('.' + Classes[15]).removeClass(Classes[15]);

		// Remove cursor styles and text-selection events bound to the body.
		if ( event.cursor ) {
			$('body').css('cursor', '').off( namespace );
		}

		// Unbind the move and end events, which are added on 'start'.
		doc.off( namespace );

		// Fire the change and set events.
		Memory.target
			.removeClass( Classes[11] +' '+ Classes[12] )
			.trigger('set')
			.trigger('change');
	}

	// Bind move events on document.
	function start ( event, data ) {

		// Mark the handle as 'active' so it can be styled.
		if( data.handles.length === 1 ) {
			data.handles[0].children().addClass(Classes[15]);
		}

		// A drag should never propagate up to the 'tap' event.
		event.stopPropagation();

		// Attach the move event.
		attach ( actions.move, doc, move, {
			 start: event.calcPoint
			,handles: data.handles
			,positions: [
				Memory.locations[0],
				Memory.locations[Memory.handles.length - 1]
			]
		});

		// Unbind all movement when the drag ends.
		attach ( actions.end, doc, end );

		// Text selection isn't an issue on touch devices,
		// so adding cursor styles can be skipped.
		if ( event.cursor ) {

			// Prevent the 'I' cursor and extend the range-drag cursor.
			$('body').css('cursor', $(event.target).css('cursor'));

			// Mark the target with a dragging state.
			if ( Memory.handles.length > 1 ) {
				Memory.target.addClass(Classes[12]);
			}

			// Prevent text selection when dragging the handles.
			$('body').on('selectstart' + namespace, false);
		}
	}

	// Move closest handle to tapped location.
	function tap ( event ) {

		var location = event.calcPoint, total = 0;

		// The tap event shouldn't propagate up and cause 'edge' to run.
		event.stopPropagation();

		// Add up the handle offsets.
		$.each( Memory.handles, function(){
			total += this.offset()[ options.style ];
		});

		// Find the handle closest to the tapped position.
		total = ( location < total/2 || Memory.handles.length === 1 ) ? 0 : 1;

		location -= Memory.base.offset()[ options.style ];

		// Find the closest handle and calculate the tapped point.
		// The set handle to the new position.
		jump( Memory.handles[total], ( location * 100 ) / Memory.baseSize() );
	}

	// Move handle to edges when target gets tapped.
	function edge ( event ) {

		var i = event.calcPoint < Memory.base.offset()[ options.style ],
			to = i ? 0 : 100;

		i = i ? 0 : Memory.handles.length - 1;

		jump( Memory.handles[i], to );
	}

	// Attach events to several slider parts.
	function events ( behaviour ) {

		// Attach the standard drag event to the handles.
		if ( !behaviour.fixed ) {

			var i;

			for ( i = 0; i < Memory.handles.length; i++ ) {

				// These events are only bound to the visual handle
				// element, not the 'real' origin element.
				attach ( actions.start, Memory.handles[i].children(), start, {
					handles: [ Memory.handles[i] ]
				});
			}
		}

		// Attach the tap event to the slider base.
		if ( behaviour.tap ) {
			attach ( actions.start, Memory.base, tap, Memory );
		}

		// Extend tapping behaviour to target
		if ( behaviour.extend ) {

			Memory.target.addClass( Classes[16] );

			if ( behaviour.tap ) {
				attach ( actions.start, Memory.target, edge, Memory );
			}
		}

		// Make the range dragable.
		if ( behaviour.drag ){

			var dragable = Memory.base.find('.'+Classes[7]).addClass(Classes[10]);

			// When the range is fixed, the entire range can
			// be dragged by the handles. The handle in the first
			// origin will propagate the start event upward,
			// but it needs to be bound manually on the other.
			if ( behaviour.fixed ) {
				dragable = dragable.add( Memory.base.children().not(dragable).data('grab') ); // todo
			}

			attach ( actions.start, dragable, start, Memory );
		}
	}


// Initialize slider

	// Throw an error if the slider was already initialized.
	if ( !$(target).is(':empty') ) {
		throw new Error('Slider was already initialized.');
	}

	// Initialise HTML and set classes.
	$.extend( Memory, addSlider.call(target, options) );

	// Attach user events.
	events( options.events );


// Methods

	// Set the slider value.
	target.set = function ( values, callback, link ){

		var i, to;

		// The RTL settings is implemented by reversing the front-end,
		// internal mechanisms are the same.
		if ( options.dir ) {
			values.reverse();
		}

		// If there are multiple handles to be set run the setting
		// mechanism twice for the first handle, to make sure it
		// can be bounced of the second one properly.
		for ( i = 0; i < ( Memory.handles.length > 1 ? 3 : 1 ); i++ ) {

			to = link || Memory.serialization[i%2][0];
			to = to.valueOf( values[i%2] );

			if ( to === false ) {
				continue;
			}

			// Calculate the new handle position
			to = toStepping( options, to );

			// Invert the value if this is a right-to-left slider.
			if ( options.dir ) {
				to = 100 - to;
			}

			if ( setHandle( Memory.handles[i%2], to ) === true ) {
				continue;
			}

			// Reset the input if it doesn't match the slider.
			$(Memory.serialization[i%2]).each(function(){
				this.write( options
					,Memory.locations[i%2]
					,Memory.handles[i%2].children()
					,Memory.target );
			});
		}

		// Optionally fire the 'set' event.
		if( callback === true ) {
			$(this).trigger('set');
		}

		return this;
	};

	// Get the slider value.
	target.get = function ( ){

		var i, retour = [];

		for ( i = 0; i < options.handles; i++ ){
			retour[i] = Memory.serialization[i][0].saved;
		}

		if ( retour.length === 1 ){
			return retour[0];
		}

		if ( options.dir ) {
			return retour.reverse();
		}

		return retour;
	};

	// Destroy the slider and unbind all events.
	target.destroy = function ( ){

		// Loop all linked serialization objects and unbind all
		// events in the noUiSlider namespace.
		$.each(Memory.serialization, function(){
			$.each(this, function(){
				// Won't remove 'change' when bound implicitly.
				this.target.off( namespace );
			});
		});

		// Unbind events on the slider, remove all classes and child elements.
		$(this).off(namespace)
			.removeClass(Classes.join(' '))
			.empty();

		// Dump storage in the closure. Garbage collector should catch this.
		Memory = null;

		// Return the original options from the closure.
		return originalOptions;
	};

	// Use the public value method to set the start values.
	$(target).val( options.start );
}


// Access points

	// Run the standard initializer
	function initialize ( originalOptions ) {

		// Test the options once, not for every slider.
		var options = test( originalOptions, this );

		// Loop all items, and provide a new closed-scope environment.
		return this.each(function(){
			closure(this, options, originalOptions);
		});
	}

	// Destroy the slider, then re-enter initialization.
	function rebuild ( options ) {

		return this.each(function(){

			// Get the current values from the slider,
			// including the initialization options.
			var values = $(this).val(),
				originalOptions = this.destroy(),

				// Extend the previous options with the newly provided ones.
				newOptions = $.extend( {}, originalOptions, options );

			// Run the standard initializer.
			$(this).noUiSlider( newOptions );

			// If the start option hasn't changed,
			// reset the previous values.
			if ( originalOptions.start === newOptions.start ) {
				$(this).val(values);
			}
		});
	}


	// Expose serialization constructor.
	$.noUiSlider = { 'Link': Link };

	$.fn.noUiSlider = function ( options, re ){
		return ( re ? rebuild : initialize ).call(this, options);
	};

	$.fn.val = function ( ){

		// Convert the function arguments to an array.
		var args = Array.prototype.slice.call( arguments, 0 );

		// Test if there are arguments, and if not, call the 'get' method.
		if ( !arguments.length ) {

			// Determine whether to use the native val method.
			if ( this.hasClass( Classes[0] ) ) {
				return this[0].get();
			}

			return $val.apply( this );
		}

		// Loop all individual items, and handle setting appropriately.
		return this.each(function(){

			if ( $(this).hasClass( Classes[0] ) ) {
				this.set.call( $(this), asArray(args[0]), args[1], args[2] );
			} else {
				$val.apply( $(this), args);
			}
		});
	};

}( window.jQuery || window.Zepto ));
