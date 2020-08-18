type BRRadioColorSet = {
	base: string;
	highlight: string;
	highlightDark: string;
}

const colors: { [k: string]: BRRadioColorSet } = {
	Bayern_1:    { base: '#00A0D5', highlight: '#98DFF1', highlightDark: '#65CEE9' },
	Bayern_2:    { base: '#FF6B00', highlight: '#F6C69C', highlightDark: '#FFC28D' },
	Bayern_3:    { base: '#94C01C', highlight: '#D5E6A6', highlightDark: '#CFE68F' },
	BR_Klassik:  { base: '#E1012C', highlight: '#F29BAC', highlightDark: '#F29BAC' },
	B5_aktuell:  { base: '#E52770', highlight: '#F4A8C5', highlightDark: '#EB86AD' },
	puls:        { base: '#000000', highlight: '#CBCBCB', highlightDark: '#CBCBCB' },
	Bayern_plus: { base: '#789BCB', highlight: '#C8D6EA', highlightDark: '#A0C0ED' },
	BR_Heimat:   { base: '#005594', highlight: '#A2CBEA', highlightDark: '#86C8F8' },
};

export const getColors = (broadcastService: any, _product: string) => {
	if (!broadcastService?.id) {
		return null;
	}
	const key = broadcastService.id.split('#')[1];
	if ( key in colors ) {
		return colors[key];
	}
	return null;
}
