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
			window['ir-textarea'].commands
				.forEach(function(cmdDef) {
					if(commands.indexOf(cmdDef.cmd) > -1)
						defs[cmdDef.cmd] = cmdDef;
				});

			// get them in order
			this.toolbarButtons = commands.map(function(c) { return defs[c]; });

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

			floatOptions = [
				{ label: 'default', value : { target : flowTarget, value : "none" }, action : this.setFloat },
				{ label: 'Left', value : { target : flowTarget, value : "left" }, action : this.setFloat },
				{ label: 'Right', value : { target : flowTarget, value : "right" }, action : this.setFloat }
			];

			cm.options.push({label: 'Float', icon: 'icons:align', info: '', options: floatOptions});
			
			return;			
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
		
		execCommand : function(e) {
			var that = this,
				cmdDef = e.currentTarget.cmdDef;

			// params: command, aShowDefaultUI (false), commandparams
			this.$.editor.focus();

			if(this.promptProcessors[cmdDef.cmd])
			{

				document.getElementById(this.promptProcessors[cmdDef.cmd]).prompt(function(val) {
					if(val)
						document.execCommand(cmdDef.cmd, false, val);

					that._updateValue();
				});
			}
			else
			if(cmdDef.val)
				document.execCommand(cmdDef.cmd, false, prompt(cmdDef.val));
			else
				document.execCommand(cmdDef.cmd, false);

			this._updateValue();
		},

		getSelection : function() {
			if (window.getSelection && window.getSelection().getRangeAt)
				this.range = window.getSelection().getRangeAt(0);

			this.$.selectionEditor.innerHTML = this.range;
		},

		setSelection : function() {
			var range = document.createRange();
			range.setStart(this.$.editor, this.caret); // 6 is the offset of "world" within "Hello world"
			range.setEnd(this.$.editor, 5); // 7 is the length of "this is"
			this.$.selectionEditor.innerHTML = this.range;
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

		_updateValue : function(e) {
			this.value = this.$.editor.innerHTML;
		},


		properties : {
			commands : {
				type : String,
				value : "bold,italic,underline,insertOrderedList,insertUnorderedList,align-left,justifyLeft,justifyCenter,justifyRight,createLink,unlink,insertImage,delete,redo,undo,foreColor,backColor,copy,cut,fontName,fontSize,indent,outdent,insertHorizontalRule,tableCreate"
			},

			promptProcessors : {
				type : Object,
				value  : {}
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
