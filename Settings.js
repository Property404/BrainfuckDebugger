function Option(name,default_value){
	this.name = name;
	this.default_value=default_value;
	if(localStorage[name] === undefined)
	{
		this.value = default_value;
		localStorage.setItem(name,default_value);
	}
	else
	{
		let val = localStorage[name];
		if(val === "true")
			val = true;
		if(val === "false")
			val = false;
		val = Number(val) || val;
		this.value = val;
	}
}

export class Settings
{
	constructor(update_callback)
	{
		this.options=
			[
				new Option("editor-keymap", "default"),
				new Option("editor-highlighting", true),
				new Option("editor-theme", "default"),
				new Option("global-theme", "dagan"),
				new Option("cell-width", 8),
				new Option("step-delay", 1),
				new Option("optimize", true),
				new Option("line-numbers", true),
			];
		this.update_callback = update_callback;
		this.options_map = {};
		for(const option of this.options)
		{
			this.options_map[option.name] = option;
		}
		this.loadToUI();
		this.setUpEvents();
	}
	
	setUpEvents()
	{
		const eventHandler = (option_name)=>{
			let value;
			if(event.target.type === "checkbox")
			{
				value = event.target.checked;
			}
			else
			{
				value = event.target.value;
			}
			if(value !== undefined)
			{
				this.options_map[option_name].value = value;
				localStorage[option_name] = value;
			}
			this.update_callback();
		};
		for(const option of this.options)
		{
			const element = document.getElementById("opt-"+option.name);
			const eh = eventHandler.bind(this, option.name);
			element.addEventListener("input",eh);
		}

	}

	loadToUI()
	{
		for(const option of this.options)
		{
			const element = document.getElementById("opt-"+option.name);
			if (element.tagName === "INPUT")
			{
				if(element.type === "number")
					element.value = option.value;
				else if(element.type === "checkbox")
				{
					const val = !!(option.value);
					if(typeof val !== "boolean")
						throw("Expected boolean value");
					element.checked = val;
				}
				else
					throw("Unknown type of input");
			}
			else if(element.tagName === "SELECT")
			{
				element.value = option.value;
			}
		}
	}

	get(option_name)
	{
		if(this.options_map[option_name])
			return this.options_map[option_name].value;
		else
			console.log("No such option: "+option_name);
	}
}
