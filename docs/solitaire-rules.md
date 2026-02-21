# Solitaire Rules

The standard rules apply to the solitaire mode of Mint Works. There are, however, a few exceptions:

- When a Plan is taken from the Supplier and not replaced by another effect, immediately replace it with 1 from the Plan Deck.
- When the AI performs the Place action, it will always place in the first available Mint Placement Space in the Location line order from the solitaire setup (Producer, Wholesaler, Builder, Supplier, Leadership Council, Lotto, then optional Advanced).
- If the AI is unable to use any Location, it chooses the Pass action.
- When performing the Place action for the AI, place the required amount of Mints from the AI's Mints on the corresponding Mint Placement Space.
- When selecting a space within a Location, the AI uses the first available space top-to-bottom.
- During the Upkeep phase, if there are no Mints on the Supplier before returning all Mints to the Mint Supply, put the 2 Plans in the Plan Supply at the bottom of the Plan Deck, and replace them with 2 new Plans from the Plan Deck.
- The AI will always build the oldest Plan in its Neighborhood first (chronological order).
- The AI will buy Plans based on their Supplier Priority, checking first for the Cost of available Plans. If there is a tie for Cost, it then checks the Type of Plan. If there is still a tie, it will buy the Plan closest to the Plan Deck. Only Plans the AI can currently afford are taken into consideration.

## Supplier Priority (Clarification)

The `$` portion determines cost preference order. For example, if the Plan Supply includes Plans with costs 1, 2, and 3:

- With `$$$ > $`, the AI will buy the cost 3 Plan.
- With `$ > $$$`, the AI will buy the cost 1 Plan.

If there is a tie in Plan cost, the AI uses the Type priority listed on its card. If there is still a tie, the AI buys the Plan closest to the Plan Deck. The Plan Supply layout is:

`(Plan 1) (Plan 2) (Plan 3) (Plan Deck)`

In solo, the Plan Supply has 2 cards, so "closest to the Plan Deck" is the rightmost card adjacent to the deck.
