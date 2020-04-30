import {Debugger} from "./Debugger.js";

const Mode = Object.freeze({
	"EDIT_MODE":1,
	"TRANSITION_MODE":2,
	"RUN_MODE":3});

let debug = new Debugger();
let mode = Mode.EDIT_MODE;



function switchToEditMode()
{
	if(mode === Mode.EDIT_MODE)
		return;
	mode = Mode.TRANSITION_MODE;
	document.querySelector("#editor-view").style.display = "block";
	document.querySelector("#debug-view").style.display = "none";
	mode = Mode.EDIT_MODE;
}

function switchToRunMode()
{
	if(mode === Mode.RUN_MODE)
	{
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

	mode = Mode.RUN_MODE;
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

function loadAndReset()
{
	let textarea = document.querySelector(".editor textarea");
	const source = textarea.value;
	/* This causes debug to reset, as well*/
	debug.load(source);
}

function step(reverse=false)
{
	debug.step(reverse);
	updateHighlight();
	console.log(debug.tape);
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
	switchToRunMode();
	if(!debug.atEnd())
	{
		step(false);
		displayStacks();
	}
});

document.querySelector("#step-back-button").addEventListener("click",()=> {
	switchToRunMode();
	if(!debug.atBeginning())
	{
		step(true);
		displayStacks();
	}
});

document.querySelector("#reset-button").addEventListener("click",()=> {
	switchToRunMode();
	loadAndReset();
	updateHighlight();
	displayStacks();
});

document.querySelector("#debug-view").addEventListener("click", ()=>{
	switchToEditMode();
});

