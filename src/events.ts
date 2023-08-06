import _GameObject, { GameObject } from "./GameObject";
import Entity from "./entities/Entity";

export interface GameObjectEvents {
   on_destroy: () => void;
   enter_collision: (collidingGameObject: GameObject) => void;
   during_collision: (collidingGameObject: GameObject) => void;
   enter_entity_collision: (collidingEntity: Entity) => void;
   during_entity_collision: (collidingEntity: Entity) => void;
}

export interface EntityEvents extends GameObjectEvents {
   hurt: (damage: number, attackingEntity: Entity | null, knockback: number, hitDirection: number | null) => void;
   death: (attackingEntity: Entity | null) => void;
   on_item_place: (placedEntity: Entity) => void;
}

export interface ProjectileEvents extends GameObjectEvents {

}

export type GameEvent<T extends GameObjectEvents, E extends keyof T> = T[E];