import {TokenType,Debugger} from "./Debugger.js";

const PAUSE_BUTTON_TEXT = "Pause";
const PLAY_BUTTON_TEXT = "Run";
const MIN_CELLS = 50;
const Mode = Object.freeze({
	// User is editing code
	"EDIT_MODE":1,
	// Transitioning between modes
	"TRANSITION_MODE":2,
	// User is stepping
	"DEBUG_MODE":3,
	// User is running the program (not stepping)
	"PLAY_MODE":4,
	// Program is waiting for user input
	"INPUT_MODE":5,
});

let mode = Mode.EDIT_MODE;
const debug = new Debugger();
// Highest_cell is used to determine
// how many (DOM)cells we have already placed
// on the (DOM)tape
let highest_cell = -1;
// Input buffer
// User produces via terminal
// BF program consumes
const input_queue = []; 
// Used to determine which state we switched
// from when switching to Input Mode
let last_state;

const code_editor = CodeMirror(document.querySelector("#edit-panel-container"),
	{
		mode: "brainfuck",
		/*keyMap:"vim",*/
		lineWrapping: true
	}
);

/* For whatever reason, I decided to call states "Modes"
 * Kinda a FSM */

function switchToInputMode()
{
	last_state = mode;
	switchToDebugMode();
	mode = Mode.INPUT_MODE;
}
function switchFromInputMode()
{
	if(last_state === Mode.PLAY_MODE)
		play();
	else if(last_state === Mode.DEBUG_MODE)
		switchToDebugMode();
	else
		throw "Unknown mode we switched from";
}
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
	document.querySelector("#edit-panel-container").style.display = "block";
	document.querySelector("#debug-panel-container").style.display = "none";
	mode = Mode.EDIT_MODE;
	updateButtons();
}

function switchToDebugMode()
{
	if([Mode.PLAY_MODE,Mode.DEBUG_MODE,Mode.INPUT_MODE].
		includes(mode))
	{
		mode = Mode.DEBUG_MODE;
		updateButtons();
		return;
	}
	mode = Mode.TRANSITION_MODE;

	loadAndReset();
	document.querySelector("#edit-panel-container").style.display="none";;
	document.querySelector("#debug-panel-container").style.display="block";;

	// Reset tape to beginning
	const tape_container = document.querySelector(".tape-container");
	tape_container.scrollLeft = 0;
	

	const debug_panel = document.querySelector("#debug-panel");
	debug_panel.innerHTML = code_editor.getValue();
	updateHighlight();

	mode = Mode.DEBUG_MODE;
	updateButtons();
}

function updateHighlight()
{
	const debug_panel = document.querySelector("#debug-panel");
	const pos=debug.getPositionInSource();
	const prechunk = debug.source.substring(0,pos);
	const postchunk = debug.source.substring(pos+1);

	const highlighted_char = document.createElement("span");
	highlighted_char.classList.add("highlight");
	highlighted_char.innerHTML=debug.source.charAt(pos);
	

	debug_panel.innerHTML=prechunk;
	debug_panel.appendChild(highlighted_char);
	debug_panel.innerHTML+=postchunk;
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
	const source = code_editor.getValue();
	console.log(source);
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
		let cell = document.querySelector("#cell-"+i+" .cell-value").innerHTML=0;
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
			const template = document.querySelector("#cell-template");
			const new_cell = template.cloneNode();
			new_cell.removeAttribute("style");
			new_cell.id="cell-"+i;
			new_cell.innerHTML = `<div class="cell-index">${i}</div><span class="cell-value">0</span>`;
			document.querySelector(".tape").appendChild(new_cell);
		}
		highest_cell = desired_amount_of_cells;
	}
	if(pointer != undefined)
	{
		let val = debug.tape[pointer];
		if(val===undefined)val=0;

		const current_cell = document.querySelector("#cell-"+pointer);
		const old_cell = document.querySelector(".cell.active");
		if(old_cell)
			old_cell.classList.remove("active");
		current_cell.querySelector(".cell-value").innerHTML=val;
		current_cell.classList.add("active");
	}
}
function step(reverse=false)
{
	debug.step(reverse);
	updateHighlight();
	updateTape();
	updateButtons();
}


function sleepmin(){
  return new Promise(resolve => true);
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function displayStacks()
{
	for(const token of debug.tokens)
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

document.querySelector("#debug-panel").addEventListener("click", ()=>{
	if(mode === Mode.DEBUG_MODE)
		switchToEditMode();
});

function addCharacterToTerminal(ch)
{
	const term = document.querySelector(".terminal");
	term.innerHTML+=ch;
	term.scrollTop = term.scrollHeight;

}
document.querySelector(".terminal").addEventListener("keydown", event=>{
	const key = event.key;
	console.log("input:"+key);
	if(event.isComposing ||
		event.keyCode === 229||
		mode !== Mode.INPUT_MODE
	)
	{
		return;
	}

	let character=key;

	if (key === "Tab")
		character="\t";
	else if (key === "Space")
		character=" ";
	else if (key === "Enter")
		character="\r";

	// ' and / open up search
	if("'/ ".includes(key))
		event.preventDefault();

	if(character.length === 1)
	{
		addCharacterToTerminal(character);
		input_queue.push(character.charCodeAt(0));
	}
	if(key==="Enter" && mode === Mode.INPUT_MODE)
		switchFromInputMode();
});

debug.output_callback=addCharacterToTerminal;

function input_callback()
{
	// If val is null, Debugger does not step
	let val = null;
	if(input_queue.length > 0)
	{
		val = input_queue.shift();
		console.log("val: "+val);
	}
	else
	{
		switchToInputMode();
	}
	return val;
}
debug.input_callback = input_callback;

clearTape();
