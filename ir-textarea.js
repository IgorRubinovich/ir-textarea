(function () {
	var KEYS = {
		ENTER : 13,
		ESC : 27,
		UP : 38,
		DOWN : 40,
		LEFT : 37,
		RIGHT : 39,
		BACKSPACE : 8
	};
	
	var KEYSHASH = {};
	Object.keys(KEYS).forEach(function(k) { KEYSHASH[KEYS[k]] = true });
		
	Polymer({
		is : 'ir-select',

/*
Fired when an item is added. The created ir-select-item is passed to handler inside `.detail` field.
@event item-added
*/
/*
Fired when an item is removed. The ir-select-item staged for removal is passed to handler inside `.detail` field.
@event item-removed
*/
/*
Fired when a duplicate item is added to selection. The item is not added to selection.
@event item-duplicate
*/
/*
Fired when item being added was not suggested, regardless of `allowCreate` value.
@event item-unknown
*/
/*
Fired adding the item would make number of selected items exceed `maxItems`.
@event item-overflow
*/
		
		
/**
Handles control characters upon keydown in the textbox.

@method _handleControlKeys
@access private
*/ 
		_handleControlKeys : function (e) {
			var val, that = this;

			if(this.itemInFocus && ([KEYS.LEFT, KEYS.RIGHT, KEYS.BACKSPACE].indexOf(e.keyCode) == -1))
			{
				this.itemInFocus.blur();
				delete this.itemInFocus;
			}
				
			this.input.focus();
			switch(e.keyCode)
			{
				case KEYS.ENTER: 
					if(this.preventDefault)
						e.preventDefault();

					if(!this.input.value)
						return;

					// val = this.$.selectBox.selectedItem ? this.suggestedOptions[this.$.selectBox.selected] : { title : this.input.value }
					
					this.addSelection(this.$.selectBox.selectedItem.item);

					this.input.value = "";
					this.suggestedOptions = [];
					
					this.$.selectBox.select(-1);
					
					break;

				case KEYS.ESC:
					this.suggestedOptions = [];

					this.$.selectBox.select(-1);

					break;
					
				// up arrow - select previous item when iron-selector is open
				case KEYS.UP: 
					if(!this.$.selectBox.selectedItem && this.$.selectBox.items.length) 
						this.$.selectBox.select	(this.$.selectBox.items[this.$.selectBox.items.length-1].value);
					else if(this.$.selectBox.selectedItem)
						this.$.selectBox.selectPrevious();						
						// this.input.value = this.$.selectBox.selectedItem.innerHTML						
					break;
				
				 // down arrow - select next item when iron-selector is open
				case KEYS.DOWN:
					if(!this.$.selectBox.selectedItem && this.$.selectBox.items.length) 
						this.$.selectBox.select(0);
					else
						this.$.selectBox.selectNext();	
						// this.input.value = this.$.selectBox.selectedItem.innerHTML						
					break;
					
				// left arrow - focus on previous item
				case KEYS.LEFT:					
					if(this.input.value)
						break;

					var children = this.getChildItems(),
						focusIndex = children.length;
						
					if(!children.length) break
					
					if(this.itemInFocus) // if not set focusIndex defaults to last one
					{
						focusIndex = children.indexOf(this.itemInFocus);
						this.itemInFocus.blur();
					}
					
					if(!focusIndex && !(focusIndex === 0))
						break;
					
					if(focusIndex >	 0)
						focusIndex--;

					this.itemInFocus = children[focusIndex];
					this.itemInFocus.focus();	

					break;

				// right arrow - focus on next item
				case KEYS.RIGHT:
					if(this.input.value || !this.itemInFocus)
						break;

					var children = this.getChildItems(),
						focusIndex = 0;
						
					if(!children.length) break
					
					focusIndex = children.indexOf(this.itemInFocus);
					this.itemInFocus.blur();
					
					if(!focusIndex && !(focusIndex === 0))
						break;
					
					if(focusIndex < children.length-1)
					{
						focusIndex++;
						this.itemInFocus = children[focusIndex];
						this.itemInFocus.focus();
						
						break;
					}

					this.itemInFocus.blur();
					delete this.itemInFocus;

					break;

				// backspace or delete remove the itemInFocus
				case KEYS.BACKSPACE:
					if(this.input.value)
						break;

					var children = this.getChildItems();
					
					if(!children.length)
						break;
					
					var focusIndex = children.length;
					if(this.itemInFocus)
					{
						focusIndex = children.indexOf(this.itemInFocus)						
						this.itemInFocus.close();						
					}
					
					if(focusIndex > 0)
						focusIndex--;
					else if(children.length > 1)
						focusIndex++;

					this.itemInFocus = children[focusIndex];
					this.itemInFocus.focus();
					
					break;
			}
		},
/**
Handles alphanumeric on keyup in textbox.

@method _handleTyping
@access private
*/
		_handleTyping : function(e)
		{
			if([KEYS.ESC, KEYS.DOWN, KEYS.UP].indexOf(e.keyCode) > -1)
				return;					// we are either navigating or suggestions were closed in _handleControlKeys and we don't want to reopen them until next typing
			
			this._loadSuggestions();
		},
		
/**
Initiates loading of suggestions by optionsLoader 

@method _loadSuggestions
@access private
*/
		_loadSuggestions : function () {
			var that = this;

			if(this.input.value.length >= this.minLength)
			{	
				this.$.optionsLoader.url = constructQuery(this.dataSource, this.queryByLabel, this.input.value);
				this.$.optionsLoader.generateRequest();
				this.$.selectBox.select(0)
			}
			else
			{
				this.$.selectBox.select(-1);
				this.suggestedOptions = [];
			}

		},

/**
Returns list of suggested options at dataPath. Only required because .get doesn't return the array if it's the root and dataPath == ""

@method _getSuggestedOptions
@access private
*/
		_getSuggestedOptions : function() {
			return this.dataPath ? this.get(this.dataPath, this.suggestedOptions) : this.suggestedOptions
		},
		
/**
Picks up `ir-select-item`s that are part of the local DOM during initialization

@method _setPreselectedOptions
@access private
*/
		_setPreselectedOptions : function() {
			var that = this;
			
			// reach to the envelope data
			(this.dataPath ? this.get(this.dataPath, this.loadedSelection) : this.loadedSelection)
				.forEach(function(o) {
					that.addSelection(o) 
				});
			
			this.$.selectionLoader.url = "";
		},
/**
Shortcut method to access all items in content (ir-select-item and input only)

@method _getChildren
@access private
*/
		_getChildren : function() {	
			var content = Polymer.dom(this.root).querySelector('content');
			return Polymer.dom(content).getDistributedNodes();
		},
/**
Returns selection of ir-select-item elements in the light DOM.

@method getChildItems
*/
		getChildItems : function() {	
			return this._getChildren().filter(function(n) { return n.is == 'ir-select-item' });
		},
/**
Get selected data out of the currently selected ir-select-item elements. 

@method 
@return { Array } of objects with labels and values at labelPath and valuePath respectively
@access public
*/
		getSelected : function() {
			var that = this, 
				res = [];

			[].forEach.call(this.getChildItems(), function(o) { 
				res.push(o.toObject(that.labelField, that.valueField)); 
			})
						
			return res;
		},

/**
Get selected data out of the currently selected ir-select-item elements - flattened to simple label-value objects, ignoring
labelPath and valuePath

@method 
@return { Array } of objects with labels and values at o.label and o.value.
@access public
*/
		getSelectedFlat : function() {
			var that = this, 
				res = [];

			[].forEach.call(this.getChildItems(), function(o) { 
				res.push(o.toObject()); 
			})
						
			return res;
		},
		
/**
Check whether obj is in selection

@method
@param {Object} obj an object as with label and value at labelPath and valuePath respectively
@return {Boolean} `true` if item is in selection, false otherwise
@access public
*/
		isSelected : function(obj)
		{
			var lp = this.labelPath, 
				vp = this.valuePath,
				val = this.get(vp, obj), 
				label = this.get(lp, obj),
				that = this;
			
			return this.getSelected().filter(function(o) { 
												var v = o.value,
													l = o.label;
	
												return 	(v == val && val != 'undefined' && typeof v != 'undefined') || 
														(l == label && typeof val == 'undefined' && typeof v == 'undefined' ) 
											}).length;
		},



/**
Adds a single item to the selection.

@method
@param {Array} selection an array of objects with label and value at labelPath valuePath respectively
@return {Boolean} True if item was added, false otherwise
@access public
*/
		addSelection : function(obj) {
			var canAdd = true;

			if(!this.get(this.valuePath, obj))
			{
				this.fire('item-unknown', obj);
				if(this.allowCreate == false || this.allowCreate == 'false')
					canAdd = false;
			}
			
			if(this.maxItems > 1 && this.getSelected().length + 1 > this.maxItems)
			{
				this.fire('item-overflow', obj);
				canAdd = false;
			}
			
			if(this.maxItems == 1 && this.getSelected().length)
			{
				this.setSelection([]);
			}
			
			if(this.isSelected(obj))
			{
				this.fire('item-duplicate', obj);
				canAdd = false;
			}

			if(!canAdd)
				return false;
			
			var item = document.createElement('ir-select-item');

			Polymer.dom(this).insertBefore(item, this.input);
			Polymer.dom.flush();			

			item.value = this.get(this.valuePath, obj);
			item.label = this.get(this.labelPath, obj);

			this._updateValue();
			
			this.fire('item-added', item);
		},
		
/*
adds item when user clicks on selectBox
@access private
*/
		_addFromSelector : function(e) {
			var index = this.$.selectBox.items.indexOf(e.target);
			
			this.addSelection(this.$.selectBox.selectedItem.item);
			//this.addSelection(this.suggestedOptions[this.$.selectBox.items.indexOf(e.target)]);

			// this.$.selectBox.select(-1);
			this.suggestedOptions = [];
		},

/**
Updates `.value` attribute when selection changes
@access private
*/
		_updateValue : function() {
			var vp = this.valuePath, 
				lp = this.labelPath,
				selected = this.getSelected(),
				value,
				that = this;

			this.value = value = !selected.length ? '' : selected
												// if there's no value use label as value
												.map(function(o) { return o.value ? o.value : o.label; })
												// filter out empty
												.filter(function (o) { return o } )
												// simple CSV
												.join(',');			
		},

/**
Select items defined in the array. Previous selection is lost.
@param {Array} selection array of objects with labels and values at labelPath and valuePath respectively.
*/
		setSelection : function(selection) 
		{
			var that = this,
				lf = this.labelField,
				vf = this.valueField;

			this.getChildItems().forEach(function(c) { c.close(); });
				
			var missingLabels = selection.filter(function(sel) { return !that.get(lf, sel) && that.get(vf, sel) });			
			
			/*this.addEventListener('item-attached', function(ev) { 
				that._updateValue();
			});*/
			
			//this._updateValue();
			
			if(!missingLabels.length)
				return

			var missingIdsList = missingLabels.map(function (sel) { return sel.value }).join(",");
			
			this.$.selectionLoader.url = constructQuery(this.dataSource, this.queryByValue, missingIdsList);
			this.$.selectionLoader.generateRequest();			
		},
		
		ready : function() {
			var that = this;
			this.addEventListener('item-attached', function(ev) { 
				that._updateValue();
			});
		},
		
		attached : function() {
			var that = this, form;
			this.input = document.createElement("input");
			
			this.input.is = "iron-input";
			Polymer.dom(this).appendChild(this.input);
			
			Polymer.dom.flush();

			this.input.addEventListener('click', function () { that._loadSuggestions(); } );
			this.input.placeholder = this.placeholder;
			
			this.addEventListener('keyup', this._handleTyping);
			this.addEventListener('keydown', this._handleControlKeys);
			this.input.type = 'text';
			
			that._updateValue();
			
			this.addEventListener('item-close', function(ev) {
				delete this.itemInFocus;
				
				this.fire('item-removed', ev.detail);
				
				var that = this;
				
				setTimeout(function() {
					Polymer.dom(that).removeChild(ev.detail);
					Polymer.dom.flush();
					that._updateValue();
				}, 300)

			});
		},
				
		properties : {
			/** Selects an entirely new set of values, old values are lost */
			selected : 				{ type : Array,		value : [],				notify : true	},

			/** input placeholder */
			placeholder : 			{ type : String,	value : "type a tag",	notify : true	},

			/** Maximum number of items that can be selected. -1 means unlimited. 1 allows automatic replacement of selection. */
			maxItems : 				{ type : Number,	value : -1,			notify : true	},

			/** Url to query */
			dataSource : 			{ type : String,	value : "",				notify : true	},

/** 
Querystring template to query suggestions by label. If contains the string `"[query]"` it will be replaced by the
query value, otherwise query is appended to queryByLabel.
*/
			queryByLabel :{ type : String,	value : "",				notify : true	},

/** 
Querystring template to query suggestions by value. If contains the string `"[query]"` it will be replaced by the
query value, otherwise query is appended to queryByValue.
*/
			queryByValue :{ type : String,	value : "",				notify : true	},

			/** Minimum length of search query required to send a request to the server */
			minLength :				{ type : Number,	value : 3,				notify : true	},

			/** Object path to label field on received objects, default is "label" */
			dataPath :	 			{ type : String,	value : "",		notify : true	},

			/** Object path to label field on received objects, default is "label" */
			labelPath : 			{ type : String,	value : "label",		notify : true	},

			/** Object path to value field on received objects, default is "value" */
			valuePath : 			{ type : String,	value : "value",		notify : true	},

			/** Prevents submission when the control in a static form and user selects an item with Enter key. */
			preventDefault : 		{ type : Boolean,	value : true,			notify : true	},
	
			/** Allows adding (new) element without value. The new label will be used instead of the value in `value` property. */
			allowCreate : 			{ type : String,	value : "true" },

/*
[read-only] a comma delimited list of "valueField" properties of the selected objects. 
@example [29,31,4,newlabel1,34]. 
*/
			value : 				{ type : String,	value : "",				notify : true },
			
			
		},
		
		observers: [
			// '_selectedChanged(selected.splices)'
		],
		
		behaviors: [
			ir.ReflectToNativeBehavior
		]
		
	});
	
	function constructQuery(baseUrl, queryTemplate, value)
	{
		var queryString;
		
		value = encodeURIComponent(value),
		queryString = queryTemplate.match(/\[query\]/) ? queryTemplate.replace(/\[query\]/, value) : queryTemplate + value;
			
		if(queryString && baseUrl && (baseUrl[baseUrl.length-1] != '?'))
			baseUrl += '?'
		
		return baseUrl + queryString;
	}
	
	function encodeQuery(q)
	{
		if(!q) 
			return ""
		return q.split("&").map(function(pair) { var res = pair.split("="); return [res[0], encodeURIComponent(res[1])].join("=") }).join('&');
	}
})();
