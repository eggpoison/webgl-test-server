import _GameObject, { GameObject } from "./GameObject";
import Entity from "./entities/Entity";

// type D = { [key: string]: (...args: any[]) => void };

// const _GameObjectEvents = {
//    enter_collision: (collidingGameObject: GameObject) => {},
//    during_collision: (collidingGameObject: GameObject) => {},
//    // enter_item_collision: (collidingItemEntity: ItemEntity) => void;
//    enter_entity_collision: (collidingEntity: Entity) => {},
//    during_entity_collision: (collidingEntity: Entity) => {}
// } satisfies { [key: string]: (...args: any[]) => any };

// type A = typeof _GameObjectEvents;

export interface GameObjectEvents {
   [key: string]: (...args: any) => any;
   enter_collision: (collidingGameObject: GameObject) => void;
   during_collision: (collidingGameObject: GameObject) => void;
   // enter_item_collision: (collidingItemEntity: ItemEntity) => void;
   enter_entity_collision: (collidingEntity: Entity) => void;
   during_entity_collision: (collidingEntity: Entity) => void;
}

export interface EntityEvents extends GameObjectEvents {
   hurt: (damage: number, attackingEntity: Entity | null) => void;
   death: () => void;
   on_knockback: (knockback: number, knockbackDirection: number) => void;
}

export type GameEvent<T extends GameObjectEvents, E extends keyof T> = T[E];
export type GameEventParams<T extends GameObjectEvents, E extends keyof T> = Parameters<T[E]>;

// type b<T extends GameObjectEvents, E extends keyof T> = Parameters<test<T, E>>;

// const a: test<GameObjectEvents, "during_collision"> = 1;
// const a: test<GameObjectEvents, "during_collision" | "enter_collision"> = (collidingGameObject: GameObject): void => {};