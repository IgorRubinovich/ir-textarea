(function () {
	Polymer({
		is : 'ir-textarea',
		ready : function() {
			console.log('rock on');
			
			var that = this, 
				commands = this.commands.split(/,/),
				newButton, cmdDef, icon;
			
			window['ir-textarea'].commands
			.forEach(function(cmdDef) {
				if(commands.indexOf(cmdDef.cmd) > -1)
				{
					//cmdDef = commands[cmdDef];
					newButton = document.createElement('paper-button');
					newButton.title = cmdDef.desc;
					newButton.cmd = cmdDef.cmd;
					newButton.setAttribute('raised', 'true');
					newButton.defaultValue = cmdDef.val;
					
					Polymer.dom(that.$.toolbar).appendChild(newButton);

					if(cmdDef.icon && cmdDef.icon.indexOf(':') > -1)
					{
						icon = document.createElement('iron-icon');
						icon.setAttribute('icon',  cmdDef.icon);
						Polymer.dom(newButton).appendChild(icon);
					}
					else
						Polymer.dom(newButton).textContent = cmdDef.cmd;
					
					//button.addEventListener('click', this.execCommand);
				}
			});
		},
		execCommand : function(e) {
			var cmd = e.target.parentNode.cmd;

			this.$.editor.focus();
			// params: command, aShowDefaultUI (false), commandparams
			document.execCommand(cmd, false, e.target.parentNode.defaultValue || "");

			this._updateValue();
		},
		
		_updateValue : function(e) {
			this.value = this.$.editor.innerHTML;
		},
		
		
		properties : {
			commands : {
				type : String,
				value : "bold,italic,underline,insertImage,align-left,justifyLeft,justifyCenter,justifyRight"
			}
		}
	})
})();
