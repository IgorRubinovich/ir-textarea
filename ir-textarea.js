(function () {
	Polymer({
		is : 'ir-textarea',
		ready : function() {
			var that = this,
				commands = this.commands.split(/,/),
				newButton, cmdDef, icon, ev, handler;

			handler = function(ev) {
				if(ev instanceof KeyboardEvent && ev.which == 13)
					ev.stopPropagation();

				that._updateValue();
			};

			"mousedown,mouseup,keydown,keyup".split(',')
				.forEach(function(evType)
				{
					that.$.editor.addEventListener(evType, handler);
				});


			var defs = {};
				window.ir.textarea.commands
				.forEach(function(cmdDef) {
					if(commands.indexOf(cmdDef.cmd) > -1)
						defs[cmdDef.cmd] = cmdDef;
				});

			// get them in order
			this.toolbarButtons = commands.map(function(c) { return c ? defs[c] : ""; });

			this.$.htmlTextArea.addEventListener("change", function () { that.$.editor.innerHTML = that.value = that.$.htmlTextArea.value });

			this._updateValue();
		},

		contextMenuShow : function(ev) {
			var cm = this.$.contextMenu, target = ev.target, flowTarget = target;

			if(!target.tagName.match("IMG|VIDEO")) // add more as implemented
				return ev.stopPropagation();

			ev.preventDefault();

			cm.options = [];

			if(target.parentNode.classList.contains('caption-wrapper'))
			{
				cm.options.push({label: 'Remove caption', icon: 'icons:list', info: '', value : ev.target, action : this.removeCaption});
				flowTarget = target.parentNode;
			}
			else
				cm.options.push({label: 'Add caption', icon: 'icons:list', info: '', value : ev.target, action : this.addCaption});

			cm.options.push({label: 'Resize', icon: 'icons:size', info: '', value : ev.target, action : this.resizeTarget});


			floatOptions = [
				{ label: 'default', value : { target : flowTarget, value : "none" }, action : this.setFloat },
				{ label: 'Left', value : { target : flowTarget, value : "left" }, action : this.setFloat },
				{ label: 'Right', value : { target : flowTarget, value : "right" }, action : this.setFloat }
			];

			cm.options.push({label: 'Float', icon: 'icons:align', info: '', options: floatOptions});

			cm.options.push({label: 'Delete', icon: 'icons:size', info: '', value : ev.target, action : this.deleteTarget.bind(this)});

			ev.screenX = ev.clientX = ev.detail.x
			ev.screenY = ev.clientY = ev.detail.y
			
			
			return;
		},

		deleteTarget : function(target) {
			this.selectionSelectElement(target);
			this.async(function() {
				this.execCommand('delete');
			});
		},
		
		resizeTarget : function(target) {
			target.style._border = target.style.border;
			target.style.border = "3px dashed grey";

			var interactable = interact(target)
				.resizable({
					edges: { left: true, right: true, bottom: true, top: true }
					/*max          : Number,
					 maxPerElement: Number,
					 manualStart  : Boolean,*/
					//snap         : {/* ... */},
					//restrict     : {/* ... */},
					//inertia      : {/* ... */},
					//autoScroll   : {/* ... */},
					/*
					 square       : true || false,
					 axis         : 'x' || 'y'*/
				})
				.on('resizemove', resizeHandler = function (event) {
					var target = event.target,
						computedStyle = getComputedStyle(target),
						
						x = (parseFloat(target.getAttribute('data-x')) || 0),
						y = (parseFloat(target.getAttribute('data-y')) || 0),
						
						sw = Number((target.style.width || computedStyle.width).replace(/px/, '')),
						sh = Number((target.style.height || computedStyle.height).replace(/px/, '')),
						ratio, w, h;


					ratio = sh/sw;

					w = event.rect.width
					h = ratio * w;

					// update the element's style
					target.style.width  = w + 'px';
					target.style.height = h + 'px';

					// translate when resizing from top or left edges
					//x += event.deltaRect.left;
					//y += event.deltaRect.top;

					target.style.webkitTransform = target.style.transform =
						'translate(' + x + 'px,' + y + 'px)';

					target.setAttribute('data-x', x);
					target.setAttribute('data-y', y);
					target.textContent = event.rect.width + '×' + event.rect.height;
				})
				.on('resizeend', function(event) {
					interactable.unset();
					target.style.border = target.style._border || "none";
				});
		},

		setFloat : function(params) {
			params.target.style.float = params.value
		},

		addCaption : function(el) {
			var p = el.parentNode,
				newEl = document.createElement('div');
			p.insertBefore(newEl, el);
			p.removeChild(el);
			newEl.appendChild(el);

			newEl.style.float = el.style.float;

			newEl.classList.add('caption-wrapper');
			newEl.innerHTML += "<p class='caption'>new caption</p>";
		},

		removeCaption : function(el) {
			var parent = el.parentNode, grandparent = parent.parentNode;
			parent.removeChild(el);
			grandparent.insertBefore(el, parent);

			el.style.float = parent.style.float;

			grandparent.removeChild(parent);
		},
		
		clickedPresetCommand : function(ev) {
			this.execCommand(ev.target.getAttribute("cmd-name"), ev.target.selected);
		},

		clickedCommand : function(e, presetval) {
				cmdDef = e.currentTarget.cmdDef;
				this.execCommand(cmdDef);
		},

		execCommand : function(cmdDefOrName, presetVal)	
		{
			var that = this, cmdDef = cmdDefOrName;
			
			if(typeof cmdDef == 'string')
				cmdDef = (window.ir.textarea.commands.filter(function(c) { return c.cmd == cmdDef }))[0]			
			
			if(!presetVal && this.promptProcessors[cmdDef.cmd])
			{
				document.getElementById(this.promptProcessors[cmdDef.cmd]).prompt(function(val) {
					if(val)
					{
						//that.$.editor.focus();
						that.selectionRestore();
						document.execCommand(cmdDef.fakeCmd || cmdDef.cmd, false, val);
						that._updateValue();
						that.selectionForget();
					}
				});
				
				return;
			}
			
			//this.$.editor.focus();
			this.async(function() {
				this.selectionRestore();
				
				if(!presetVal && cmdDef.val)
					document.execCommand(cmdDef.cmd, false, prompt(cmdDef.val));
				else
					document.execCommand(cmdDef.cmd, false, presetVal);

				this.selectionForget();
				
				this._updateValue();
			});
		},

		selectionSave : function () {
			var sel, range;
			if (window.getSelection) {
				sel = window.getSelection();
				if (sel.getRangeAt && sel.rangeCount) {
					range = sel.getRangeAt(0);
				}
			} else if (document.selection && document.selection.createRange) {
				range = document.selection.createRange();
			}
			
			this._selectionRange = range;
		},

		selectionRestore : function () {
			var range = this._selectionRange, sel;
			if (range) {
				if (window.getSelection) {
					sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (document.selection && range.select) {
					range.select();
				}
			}
		},
		
		selectionForget : function() {
			this._selectionRange = null;
		},

		selectionSelectElement : function(el) {
			var range = document.createRange();
			range.selectNode(el);
			var sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
			this.selectionSave();
		},
		
		_updateValue : function(e) {
			this.selectionSave();
			this.value = this.$.editor.innerHTML;
		},
		
		_focusedEditor : function() {
			//this.selectionRestore();
		},
		
		_blurredEditor : function() {
			this.selectionSave();
		},

		viewModeChanged : function(to, from)
		{
			if(from == 1 && to == 0)
				this.$.editor.innerHTML = this.value;
		},

		getCaretCharacterOffset : function getCaretCharacterOffset() {
			// modified from code by Tim Down http://stackoverflow.com/users/96100/tim-down
			var element = this.$.editor;
			var caretOffset = 0;
			var doc = element.ownerDocument || element.document;
			var win = doc.defaultView || doc.parentWindow;
			var sel;
			if (typeof win.getSelection != "undefined") {
				sel = win.getSelection();
				if (sel.rangeCount > 0) {
					var range = win.getSelection().getRangeAt(0);
					var preCaretRange = range.cloneRange();
					preCaretRange.selectNodeContents(element);
					preCaretRange.setEnd(range.endContainer, range.endOffset);
					caretOffset = preCaretRange.toString().length;
				}
			} else if ( (sel = doc.selection) && sel.type != "Control") {
				var textRange = sel.createRange();
				var preCaretTextRange = doc.body.createTextRange();
				preCaretTextRange.moveToElementText(element);
				preCaretTextRange.setEndPoint("EndToEnd", textRange);
				caretOffset = preCaretTextRange.text.length;
			}

			this.selection = {
				caretOffset : caretOffset
			}

			return caretOffset;
		},

		properties : {
			commands : {
				type : String,
				value : "removeFormat,bold,italic,underline,insertOrderedList,insertUnorderedList,align-left,justifyLeft,justifyCenter,justifyRight,createLink,unlink,insertImage,delete,redo,undo,foreColor,backColor,copy,cut,,fontName,fontSize,,indent,outdent,insertHorizontalRule,tableCreate"
			},

			promptProcessors : {
				type : Object,
				value  : {}
			},

			viewMode : {
				type : Number,
				value : 0,
				observer : "viewModeChanged"
			},

			value : {
				type : String,
				notify : true
			}
		},

		behaviors: [
			ir.ReflectToNativeBehavior
		]

	})

	function replaceSelectionWithHtml(html) {
		// code by Tim Down http://stackoverflow.com/users/96100/tim-down
		var range, html;
		if (window.getSelection && window.getSelection().getRangeAt) {
			range = window.getSelection().getRangeAt(0);
			range.deleteContents();
			var div = document.createElement("div");
			div.innerHTML = html;
			var frag = document.createDocumentFragment(), child;
			while ( (child = div.firstChild) ) {
				frag.appendChild(child);
			}
			range.insertNode(frag);
		} else if (document.selection && document.selection.createRange) {
			range = document.selection.createRange();
			range.pasteHTML(html);
		}
	}
})();
