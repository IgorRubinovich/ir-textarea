if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};


window.ir.textarea.editorMutationHandler =
	(function() {
		var utils = window.ir.textarea.utils;
		
		return function(mrecs) {
			this.disconnectEditorObserver();

			var totalVisits = 0, ce, pe, tnc, created, r, sc, so, ec, eo, done, upToDate,
				effectiveChanges = [], customEls = this.customElements;

			for(i = 0; i < customEls.length; i++)
				if(!Polymer.dom(customEls[i]).parentNode)
					customEls.splice(i, 1);

			this.observerCycle++;

			if(r = utils.getSelectionRange())
			{
				if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
				if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
			}
			else
				r = {}

			// update this.customElements - list of custom elements
			mrecs.forEach(function(mr) {
				var mrt = mr.target;
				if(!mrt.parentNode)
					return;

				// ignore if node appears more than once in this record - until we actually analyze the record types
				if(mrt.observerCycle == this.observerCycle)
					return;
				mrt.observerCycle = this.observerCycle;

				if(mr.type == 'childList')
					utils.visitNodes(mrt, function(n) {
						totalVisits++;
						if(n.nodeType != 3) n.isDelimiter = false;
						if(n != this.$.editor && !utils.isInLightDom(n, this.$.editor) || !Polymer.dom(n).parentNode)
							return;
						if(n.is && customEls.indexOf(n) == -1)
							customEls.push(n);
							//n.setAttribute('contenteditable', false);
					}.bind(this));
			}.bind(this));


			for(i = 0; i < customEls.length; i++)
			{
				ce = customEls[i];

				pe = Polymer.dom(ce).parentNode;
				if(pe)
				{
					pe.normalize();

					ce.setAttribute('contenteditable', false);

					// auto-editable lightdom children - should come as a property
					Array.prototype.forEach.call(Polymer.dom(ce).querySelectorAll('.caption'), function(el) { el.setAttribute('contenteditable', true) });
				}
			}

			
			if(effectiveChanges.length)
				this.changed = true;

			var cycles = 0,	cycleLabel = new Date().getTime();

			effectiveChanges.forEach(function(mr) {
				var t = mr, done, cv, cn, ocv, toutline, altp, tcea;

				if(t.isDelimiter && (t.nodeType != 3 || /\S/.test(t.textContent)))
					t.isDelimiter = false;
				
				if(t.cycleLabel == cycleLabel) return;
				t.cycleLabel = cycleLabel;

				if(t != this.$.editor && !utils.isInLightDom(t, this.$.editor))
					return;

				tcea = utils.getTopCustomElementAncestor(t, this.$.editor);
				if(tcea && tcea != t && tcea.originalInnerHTML)
					return;					

				ocv = t._cleanValue;

				if(t != this.$.editor)
					t._cleanValue = this.getCleanValue(t);

				if(t != this.$.editor && ocv == t._cleanValue)
					return;

				while(!done) // update parents
				{
					if(t != this.$.editor) {
						if(!t || !utils.isInLightDom(t.parentNode, this.$.editor)) // it's not attached
						{
							altp = Polymer.dom(t).parentNode;
							if(altp != this.$.editor && !utils.isInLightDom(altp, this.$.editor))
								return;
							t = altp;
						}
						else
							t = t.parentNode
					}

					if(t == this.$.editor)
						done = true;

					ocv = t._cleanValue;

					if(t.nodeType == 3)
						t._cleanValue = t.textContent;
					else
					{

						if(t.originalInnerHTML)							
							cv = t.originalInnerHTML;
						else
						{
							cn = (t.is ? Polymer.dom(t) : t).childNodes;
							cv = "";
						
							if(cn.length)
								cv = Array.prototype.map.call(cn, function(ch) {
									if(ch.isDelimiter && (ch.nodeType != 3 || /\S/.test(t.textContent)))
									{
										t._cleanValue = '';
										t.isDelimiter = false;
									}
									return ch._cleanValue || (ch._cleanValue = this.getCleanValue(ch))
								}.bind(this)).join('');
						}
						
						if(t != this.$.editor)
						{
							toutline = utils.tagOutline(t);
							toutline = toutline.split(">");
							t._cleanValue = toutline[0] + ">" + cv + toutline[1] + ">";
						}
						else
							t._cleanValue = cv;
					}

					if(ocv == t._cleanValue)
						return;

					cycles++;
				}
			}.bind(this))

			if(cycles > 0)
				this._updateValue(true);
			
			
			this.connectEditorObserver();
		}
	})();