import ItemEntity from "./items/ItemEntity";

export interface Events {
   death: () => void;
   item_pickup: (itemEntity: ItemEntity) => void;
}

export type EventType = keyof Events;
export type Event<E extends EventType> = Events[E];
export type EventParams<E extends EventType> = Parameters<Events[E]>;