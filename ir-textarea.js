(function () {
	Polymer({
		is : 'ir-textarea',
		ready : function() {
			console.log('rock on');
			
			var that = this, 
				commands = this.commands.split(/,/),
				newButton, cmdDef, icon, ev;
			
			"mousedown,mouseup,keydown,keyup".split(',')
				.forEach(function(ev)  
				{
					that.$.editor.addEventListener(ev, 
						function() { 
							that._updateValue();
						});
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
		
		
		execCommand : function(e) {
			console.log(cmdDef);
			var cmdDef = e.currentTarget.cmdDef;

			console.log(cmdDef);
			// params: command, aShowDefaultUI (false), commandparams
			//e.stopPropagation();
			//e.stopImmediatePropagation()
			this.$.editor.focus();
			
			if(this.promptProcessors[cmdDef.cmd])
				
				document.getElementById(this.promptProcessors[cmdDef.cmd]).prompt(function(val) {
					if(val)
						document.execCommand(cmdDef.cmd, false, val);
					this._updateValue();
				});
			else
				document.execCommand(cmdDef.cmd, false, cmdDef.val || "");

			this._updateValue();

			//console.log(e.currentTarget, e.currentTarget.cmd, cmd, false, e.target.parentNode.defaultValue || "")

			//replaceSelectionWithHtml("<b>here is your cursor</b>")
			
			this._updateValue();
			e.preventDefault();
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
				value : "bold,italic,underline,align-left,justifyLeft,justifyCenter,justifyRight,createLink,insertImage"
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
