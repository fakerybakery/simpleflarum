/**
* @type {boolean} Whether current EM span is being closed by current emphasis mark
*/
let closeEm;

/**
* @type {boolean} Whether current EM span is being closed by current emphasis mark
*/
let closeStrong;

/**
* @type {number} Starting position of the current EM span in the text
*/
let emPos;

/**
* @type {number} Ending position of the current EM span in the text
*/
let emEndPos;

/**
* @type {number} Number of emphasis characters unused in current span
*/
let remaining;

/**
* @type {number} Starting position of the current STRONG span in the text
*/
let strongPos;

/**
* @type {number} Ending position of the current STRONG span in the text
*/
let strongEndPos;

function parse()
{
	parseEmphasisByCharacter('*', /\*+/g);
	parseEmphasisByCharacter('_', /_+/g);
}

/**
* Adjust the ending position of current EM and STRONG spans
*/
function adjustEndingPositions()
{
	if (closeEm && closeStrong)
	{
		if (emPos < strongPos)
		{
			emEndPos += 2;
		}
		else
		{
			++strongEndPos;
		}
	}
}

/**
* Adjust the starting position of current EM and STRONG spans
*
* If both EM and STRONG are set to start at the same position, we adjust their position
* to match the order they are closed. If they start and end at the same position, STRONG
* starts before EM to match Markdown's behaviour
*/
function adjustStartingPositions()
{
	if (emPos >= 0 && emPos === strongPos)
	{
		if (closeEm)
		{
			emPos += 2;
		}
		else
		{
			++strongPos;
		}
	}
}

/**
* End current valid EM and STRONG spans
*/
function closeSpans()
{
	if (closeEm)
	{
		--remaining;
		addTagPair('EM', emPos, 1, emEndPos, 1);
		emPos = -1;
	}
	if (closeStrong)
	{
		remaining -= 2;
		addTagPair('STRONG', strongPos, 2, strongEndPos, 2);
		strongPos = -1;
	}
}

/**
* Get emphasis markup split by block
*
* @param  {!RegExp} regexp Regexp used to match emphasis
* @param  {number}  pos    Position in the text of the first emphasis character
* @return {!Array}         Each array contains a list of [matchPos, matchLen] pairs
*/
function getEmphasisByBlock(regexp, pos)
{
	let block    = [],
		blocks   = [],
		breakPos = text.indexOf("\x17", pos),
		m;

	regexp.lastIndex = pos;
	while (m = regexp.exec(text))
	{
		let matchPos = m.index,
			matchLen = m[0].length;

		// Test whether we've just passed the limits of a block
		if (matchPos > breakPos)
		{
			blocks.push(block);
			block    = [];
			breakPos = text.indexOf("\x17", matchPos);
		}

		// Test whether we should ignore this markup
		if (!ignoreEmphasis(matchPos, matchLen))
		{
			block.push([matchPos, matchLen]);
		}
	}
	blocks.push(block);

	return blocks;
}


/**
* Test whether emphasis should be ignored at the given position in the text
*
* @param  {number}  pos Position of the emphasis in the text
* @param  {number}  len Length of the emphasis
* @return {boolean}
*/
function ignoreEmphasis(pos, len)
{
	// Ignore single underscores between alphanumeric characters
	return (text.charAt(pos) === '_' && len === 1 && isSurroundedByAlnum(pos, len));
}

/**
* Open EM and STRONG spans whose content starts at given position
*
* @param {number} pos
*/
function openSpans(pos)
{
	if (remaining & 1)
	{
		emPos     = pos - remaining;
	}
	if (remaining & 2)
	{
		strongPos = pos - remaining;
	}
}

/**
* Parse emphasis and strong applied using given character
*
* @param  {string} character Markup character, either * or _
* @param  {!RegExp} regexp    Regexp used to match the series of emphasis character
*/
function parseEmphasisByCharacter(character, regexp)
{
	let pos = text.indexOf(character);
	if (pos === -1)
	{
		return;
	}

	getEmphasisByBlock(regexp, pos).forEach(processEmphasisBlock);
}


/**
* Process a list of emphasis markup strings
*
* @param {!Array<!Array<number>>} block List of [matchPos, matchLen] pairs
*/
function processEmphasisBlock(block)
{
	emPos     = -1,
	strongPos = -1;

	block.forEach((pair) =>
	{
		processEmphasisMatch(pair[0], pair[1]);
	});
}

/**
* Process an emphasis mark
*
* @param {number} matchPos
* @param {number} matchLen
*/
function processEmphasisMatch(matchPos, matchLen)
{
	let canOpen  = !isBeforeWhitespace(matchPos + matchLen - 1),
		canClose = !isAfterWhitespace(matchPos),
		closeLen = (canClose) ? Math.min(matchLen, 3) : 0;

	closeEm      = !!(closeLen & 1) && emPos     >= 0;
	closeStrong  = !!(closeLen & 2) && strongPos >= 0;
	emEndPos     = matchPos;
	strongEndPos = matchPos;
	remaining    = matchLen;

	adjustStartingPositions();
	adjustEndingPositions();
	closeSpans();

	// Adjust the length of unused markup remaining in current match
	remaining = (canOpen) ? Math.min(remaining, 3) : 0;
	openSpans(matchPos + matchLen);
}