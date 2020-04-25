import Debugger from './main.mjs'
function assert(claim, message, object)
{
	if (message == undefined)
		message = "<no message>";
	if(!claim)
	{
		console.log("--ASSERTION FAILED--");
		if(object)
			object.displayTape();
		throw "Assertion failed:" + message;
	}
}
function test(func)
{
	if(func())
		console.log(func.name + " PASSED");
	else
		console.log(func.name + " FAILED");
}

function congruent_state_test(){
	const sources = ["+++[->++<]>>--->>++",
		"+++++[-]+++",
		" ++++++++[->-[->-[->-[-]<]<]<] ++++++++[<++++++++++>-]<[>+>+<<-]>-.>-----.>++++++++++."

	];

	for(let source of sources)
	{
		let debug = new Debugger(source);

		while(!debug.atEnd())
		{
			debug.step();
		}


		const first_final_hash = debug.getStateHash();
		debug.reset();

		for(let i=0;!debug.atEnd();i++)
		{
			const hash1=debug.getStateHash();
			debug.step();

			const hash2=debug.getStateHash();
			debug.step(true);

			const hash3=debug.getStateHash();
			debug.step();

			const hash4=debug.getStateHash();

			assert(hash1===hash3, "hash1!==hash3", debug);
			assert(hash2===hash4, "hash2!==hash4", debug);
		}

		assert(debug.getStateHash()===first_final_hash, "Final hash failed");
	}
	return true;
};

test(congruent_state_test);
console.log("finished.")
