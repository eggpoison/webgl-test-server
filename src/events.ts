import Entity from "./entities/Entity";
import ItemEntity from "./items/ItemEntity";

export interface Events {
   hurt: (attackingEntity: Entity | null) => void;
   death: () => void;
   item_pickup: (itemEntity: ItemEntity) => void;
   enter_collision: (collidingEntity: Entity) => void;
}

export type EventType = keyof Events;
export type Event<E extends EventType> = Events[E];
export type EventParams<E extends EventType> = Parameters<Events[E]>;