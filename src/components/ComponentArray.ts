import Entity from "../GameObject";
import { HealthComponent } from "./HealthComponent";
import InventoryComponent from "./InventoryComponent";
import { ItemComponent } from "./ItemComponent";
import { StatusEffectComponent } from "./StatusEffectComponent";
import { TribeComponent } from "./TribeComponent";
import { TotemBannerComponent } from "./TotemBannerComponent";

class ComponentArray<T extends {}> {
   private components = new Array<T>();
   
   /** Maps entity IDs to component indexes */
   private entityToIndexMap: Record<number, number> = {};
   // @Cleanup: Do we need this?
   /** Maps component indexes to entity IDs */
   private indexToEntityMap: Record<number, number> = {};
   
   public addComponent(entity: Entity, component: T): void {
      if (this.entityToIndexMap.hasOwnProperty(entity.id)) {
         throw new Error("Component added to same entity twice.");
      }

      // Put new entry at end and update the maps
      const newIndex = this.components.length;
      this.entityToIndexMap[entity.id] = newIndex;
      this.indexToEntityMap[newIndex] = entity.id;
      this.components.push(component);
   }

   public getComponent(entity: Entity): T {
      return this.components[this.entityToIndexMap[entity.id]];
   }

   public hasComponent(entity: Entity): boolean {
      return this.entityToIndexMap.hasOwnProperty(entity.id);
   }
}

export const TribeComponentArray = new ComponentArray<TribeComponent>();
export const InventoryComponentArray = new ComponentArray<InventoryComponent>();
export const HealthComponentArray = new ComponentArray<HealthComponent>();
export const ItemComponentArray = new ComponentArray<ItemComponent>();
export const StatusEffectComponentArray = new ComponentArray<StatusEffectComponent>();
export const TotemBannerComponentArray = new ComponentArray<TotemBannerComponent>();