import {TokenType,Debugger} from "./Debugger.js";

const PAUSE_BUTTON_TEXT = "Pause";
const PLAY_BUTTON_TEXT = "Run";
const MIN_CELLS = 50;
const Mode = Object.freeze({
	"EDIT_MODE":1,
	"TRANSITION_MODE":2,
	"DEBUG_MODE":3,
	"PLAY_MODE":4,
});

let mode = Mode.EDIT_MODE;
let debug = new Debugger();
let highest_cell = -1;


function switchToPlayMode()
{
	switchToDebugMode();
	mode = Mode.PLAY_MODE;
	updateButtons();
}

function switchToEditMode()
{
	if(mode === Mode.EDIT_MODE)
		return;
	mode = Mode.TRANSITION_MODE;
	document.querySelector("#editor-view").style.display = "block";
	document.querySelector("#debug-view").style.display = "none";
	mode = Mode.EDIT_MODE;
	updateButtons();
}

function switchToDebugMode()
{
	if(mode === Mode.DEBUG_MODE)
	{
		return;
	}
	if(mode === Mode.PLAY_MODE)
	{
		mode = Mode.DEBUG_MODE;
		updateButtons();
		return;
	}
	mode = Mode.TRANSITION_MODE;
	loadAndReset();
	let textarea = document.querySelector("#editor-view");
	let debug_view = document.querySelector("#debug-view");

	textarea.style.display = "none";
	debug_view.style.display = "block";

	debug_view.innerHTML = textarea.value;

	updateHighlight();

	mode = Mode.DEBUG_MODE;
	updateButtons();
}

function updateHighlight()
{
	let debug_view = document.querySelector("#debug-view");
	const pos=debug.getPositionInSource();
	const prechunk = debug.source.substring(0,pos);
	const postchunk = debug.source.substring(pos+1);

	let highlighted_char = document.createElement("span");
	highlighted_char.classList.add("highlight");
	highlighted_char.innerHTML=debug.source.charAt(pos);
	

	debug_view.innerHTML=prechunk;
	debug_view.appendChild(highlighted_char);
	debug_view.innerHTML+=postchunk;
}

function updateButtons()
{
	if(debug.atEnd())
	{
		document.querySelector("#playpause-button").disabled=true;
		document.querySelector("#step-forward-button").disabled=true;
	}
	else
	{
		document.querySelector("#playpause-button").disabled=false;
		document.querySelector("#step-forward-button").disabled=false;
	}

	if(debug.atBeginning())
	{
		document.querySelector("#step-back-button").disabled=true;
	}
	else
	{
		document.querySelector("#step-back-button").disabled=false;
	}

	if(mode === Mode.PLAY_MODE)
	{
		document.querySelector("#playpause-button").innerHTML=PAUSE_BUTTON_TEXT;
	}
	else
	{
		document.querySelector("#playpause-button").innerHTML=PLAY_BUTTON_TEXT;
	}
}

function loadAndReset()
{
	let textarea = document.querySelector(".editor textarea");
	const source = textarea.value;
	/* This causes debug to reset, as well*/
	debug.load(source);
	updateButtons();
	clearTape();
}

function clearTape()
{
	updateTape();
	for(let i=0;i<highest_cell;i++)
	{
		let cell = document.querySelector("#cell-"+i).innerHTML=0;
	}
}
function updateTape()
{
	let pointer = debug.pointer;
	let desired_amount_of_cells = pointer>MIN_CELLS?pointer:MIN_CELLS;
	if(desired_amount_of_cells > highest_cell)
	{
		for(let i=highest_cell+1;i<=desired_amount_of_cells;i++)
		{
			let template = document.querySelector("#cell-template");
			let new_cell = template.cloneNode();
			new_cell.removeAttribute("style");
			new_cell.id="cell-"+i;
			new_cell.innerHTML = "0";
			document.querySelector(".tape").appendChild(new_cell);
		}
		highest_cell = desired_amount_of_cells;
	}
	if(pointer != undefined)
	{
		let val = debug.tape[pointer];
		if(val===undefined)val=0;

		let current_cell = document.querySelector("#cell-"+pointer);
		let old_cell = document.querySelector(".cell.active")
		if(old_cell)
			old_cell.classList.remove("active");
		current_cell.innerHTML=val;
		current_cell.classList.add("active");
	}
}
function step(reverse=false)
{
	let will_update_tape = false;
	let next_token = null
	debug.step(reverse);
	updateHighlight();
	updateTape();
	updateButtons();
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function displayStacks()
{
	for(let token of debug.tokens)
	{
		if(token.character==='[')
		{
			console.log(token.pass_stack);
			console.log(token.in_progress);
		}
	}
}


document.querySelector("#step-forward-button").addEventListener("click",()=> {
	switchToDebugMode();
	if(!debug.atEnd())
	{
		step(false);
	}
});

function pause()
{
	document.querySelector("#playpause-button").removeEventListener("click",pause);
	document.querySelector("#playpause-button").addEventListener("click",play);
	switchToDebugMode();
}
async function play(){
	switchToPlayMode();
	document.querySelector("#playpause-button").removeEventListener("click",play);
	document.querySelector("#playpause-button").addEventListener("click",pause);
	while(!debug.atEnd() && mode === Mode.PLAY_MODE)
	{
		step();
		await sleep(0);
	}
	if(mode === Mode.PLAY_MODE)
	{
		pause();
	}
}

document.querySelector("#step-back-button").addEventListener("click",()=> {
	switchToDebugMode();
	if(!debug.atBeginning())
	{
		step(true);
	}
});

document.querySelector("#playpause-button").addEventListener("click",play);

document.querySelector("#reset-button").addEventListener("click",()=> {
	switchToDebugMode();
	loadAndReset();
	updateHighlight();
});

document.querySelector("#debug-view").addEventListener("click", ()=>{
	if(mode === Mode.DEBUG_MODE)
		switchToEditMode();
});

debug.output_callback=(val)=>{
	document.querySelector(".terminal").innerHTML+=val;
};

clearTape();
