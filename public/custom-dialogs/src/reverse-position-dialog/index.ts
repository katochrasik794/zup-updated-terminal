import { IBrokerTerminal, Position } from '../../../charting_library/broker-api';
import './index.css';

export function createReversePositionDialog(onResultCallback: (result: boolean) => void): HTMLElement {
	const reversePositionDialog = document.createElement('div');

	reversePositionDialog.classList.add('reverse-position-dialog');

	reversePositionDialog.innerHTML = `
		<div class="reverse-position-dialog__header">
			Reverse Position
		</div>
		<div id="reverse-position-content" class="reverse-position-dialog__content">

		</div>
		<div class="reverse-position-dialog__confirmation-section">
			<button id="reverse-position-cancel">Cancel</button>
			<button id="reverse-position-confirm">Confirm</button>
		</div>
	`;

	document.body.appendChild(reversePositionDialog);

	const cancelButton = document.getElementById('reverse-position-cancel');

	cancelButton?.addEventListener('click', () => {
		onResultCallback(false);
	});

	return reversePositionDialog;
}

type CreateReversePositionButtonListener = (position: Position, onResultCallback: (result: boolean) => void) => () => void;

export function createReversePositionButtonListenerFactory(broker: IBrokerTerminal): CreateReversePositionButtonListener {
	return (position: Position, onResultCallback: (result: boolean) => void) => {
		return () => {
			broker.reversePosition?.(position.id)
				.then(() => {
					onResultCallback(true);
				})
				.catch(() => {
					onResultCallback(false);
				});
		};
	};
}

function createReversePositionContent(positionContentElement: HTMLElement, position: Position): void {
	positionContentElement.innerHTML = `
		<p>Are you sure you want to reverse position ${position.id}?</p>
		<p>
			<b>Position Summary</b><br/>
			Symbol: <b>${position.symbol}</b><br/>
			Quantity: <b>${position.qty}</b><br/>
			Side: <b>${position.side}</b><br/>
			Average Price: <b>${position.avgPrice}</b>
		</p>
	`;
}

export function showReversePositionDialog(customReversePositionDialog: HTMLElement, buttonListener: () => void, position: Position): void {
	customReversePositionDialog.style.display = 'flex';

	const positionContent = document.getElementById('reverse-position-content');
	const confirmButton = document.getElementById('reverse-position-confirm');

	if (positionContent) {
		createReversePositionContent(positionContent, position);
	}

	confirmButton?.addEventListener('click', buttonListener);
}

export function hideReversePositionDialog(customReversePositionDialog: HTMLElement, buttonListener: () => void): void {
	customReversePositionDialog.style.display = 'none';
	const confirmButton = document.getElementById('reverse-position-confirm');
	confirmButton?.removeEventListener('click', buttonListener);
}
