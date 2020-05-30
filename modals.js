let highest_z_index = 10;

function focusOnModal(id)
{
	const modal = document.getElementById(id);
	highest_z_index++;
	modal.style.zIndex = highest_z_index;
}

function openModal(id)
{
	const modal = document.getElementById(id);
	focusOnModal(id);
	modal.removeAttribute("hidden");
}

// Allow user to close modal by pressing the little 'x'
function closeModal(id)
{
	const modal = document.getElementById(id);
	modal.setAttribute("hidden",true);
}

// If a modal has multiple panels, allow switching
function switchToPanel(id)
{
	const main_view	= this.querySelector(".modal-main-view");
	let found = false;
	for(const panel of main_view.children)
	{
		if(panel.id === id)
		{
			found = true;
			panel.removeAttribute("hidden");
		}
		else
		{
			panel.hidden = true;
		}
	}
	if(!found)throw("Can't switch to panel "+id);
}

for(const modal of document.querySelectorAll(".modal"))
{
	const close_button = modal.querySelector(".close-modal");
	if(close_button)close_button.addEventListener("click",
		closeModal.bind(null,modal.id));

	modal.addEventListener("click",focusOnModal.bind(null,modal.id));

	const switch_buttons = modal.querySelectorAll(".modal-nav button");
	for(const switch_button of switch_buttons)
	{
		const switch_id = switch_button.getAttribute("data-goto");
		console.log(switch_id);
		if(switch_button !== switch_buttons[0])
			document.querySelector(`#${switch_id}`).hidden = true

		switch_button.addEventListener("click",switchToPanel.bind(modal, switch_id));
	}
}

for(const button of document.querySelectorAll(".modal-activator"))
{
	let handler;
	if(button.hasAttribute("data-modal-open"))
	{
		handler = openModal.bind(null,button.getAttribute("data-modal-open"));
	}
	else if(button.hasAttribute("data-modal-focus"))
	{
		const id = button.getAttribute("data-modal-focus");
		console.log(id);
		const modal = document.getElementById(id);
		console.log(modal);
		handler = focusOnModal.bind(null, id);
	}
	else
		continue;
	button.addEventListener("click", handler);
}
