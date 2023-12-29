import Entity from "../Entity";
import { HealthComponent } from "./HealthComponent";
import { ItemComponent } from "./ItemComponent";
import { StatusEffectComponent } from "./StatusEffectComponent";
import { TribeComponent } from "./TribeComponent";
import { TotemBannerComponent } from "./TotemBannerComponent";
import { InventoryComponent } from "./InventoryComponent";
import { TreeComponent } from "./TreeComponent";
import { BerryBushComponent } from "./BerryBushComponent";
import { InventoryUseComponent } from "./InventoryUseComponent";
import { BoulderComponent } from "./BoulderComponent";
import { IceShardComponent } from "./IceSpikesComponent";
import { CowComponent } from "./CowComponent";
import { WanderAIComponent } from "./WanderAIComponent";
import { EscapeAIComponent } from "./EscapeAIComponent";
import { AIHelperComponent } from "./AIHelperComponent";
import { FollowAIComponent } from "./FollowAIComponent";
import { CactusComponent } from "./CactusComponent";
import { TribeMemberComponent } from "./TribeMemberComponent";
import { PlayerComponent } from "./PlayerComponent";
import { TribesmanComponent } from "./TribesmanComponent";
import { TombstoneComponent } from "./TombstoneComponent";
import { ZombieComponent } from "./ZombieComponent";
import { SlimewispComponent } from "./SlimewispComponent";
import { SlimeComponent } from "./SlimeComponent";
import { ArrowComponent } from "./ArrowComponent";
import { YetiComponent } from "./YetiComponent";
import { SnowballComponent } from "./SnowballComponent";
import { FishComponent } from "./FishComponent";
import Board from "../Board";
import { FrozenYetiComponent } from "./FrozenYetiComponent";
import { RockSpikeProjectileComponent } from "./RockSpikeProjectileComponent";
import { CookingEntityComponent } from "./CookingEntityComponent";

class ComponentArray<T extends {}> {
   public components = new Array<T>();
   
   /** Maps entity IDs to component indexes */
   private entityToIndexMap: Record<number, number> = {};
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

   public removeComponent(entity: Entity): void {
		// Copy element at end into deleted element's place to maintain density
      const indexOfRemovedEntity = this.entityToIndexMap[entity.id];
      this.components[indexOfRemovedEntity] = this.components[this.components.length - 1];

		// Update map to point to moved spot
      const entityOfLastElement = this.indexToEntityMap[this.components.length - 1];
      this.entityToIndexMap[entityOfLastElement] = indexOfRemovedEntity;
      this.indexToEntityMap[indexOfRemovedEntity] = entityOfLastElement;

      delete this.entityToIndexMap[entity.id];
      delete this.indexToEntityMap[this.components.length - 1];
      this.components.pop();
   }

   public hasComponent(entity: Entity): boolean {
      return this.entityToIndexMap.hasOwnProperty(entity.id);
   }

   public getEntity(index: number): Entity {
      const id = this.indexToEntityMap[index];
      return Board.entityRecord[id];
   }
}

export const TribeComponentArray = new ComponentArray<TribeComponent>();
export const InventoryComponentArray = new ComponentArray<InventoryComponent>();
export const HealthComponentArray = new ComponentArray<HealthComponent>();
export const ItemComponentArray = new ComponentArray<ItemComponent>();
export const StatusEffectComponentArray = new ComponentArray<StatusEffectComponent>();
export const TotemBannerComponentArray = new ComponentArray<TotemBannerComponent>();
export const TreeComponentArray = new ComponentArray<TreeComponent>();
export const BerryBushComponentArray = new ComponentArray<BerryBushComponent>();
export const InventoryUseComponentArray = new ComponentArray<InventoryUseComponent>();
export const BoulderComponentArray = new ComponentArray<BoulderComponent>();
export const IceShardComponentArray = new ComponentArray<IceShardComponent>();
export const CowComponentArray = new ComponentArray<CowComponent>();
export const WanderAIComponentArray = new ComponentArray<WanderAIComponent>();
export const EscapeAIComponentArray = new ComponentArray<EscapeAIComponent>();
export const AIHelperComponentArray = new ComponentArray<AIHelperComponent>();
export const FollowAIComponentArray = new ComponentArray<FollowAIComponent>();
export const CactusComponentArray = new ComponentArray<CactusComponent>();
export const TribeMemberComponentArray = new ComponentArray<TribeMemberComponent>();
export const PlayerComponentArray = new ComponentArray<PlayerComponent>();
export const TribesmanComponentArray = new ComponentArray<TribesmanComponent>();
export const TombstoneComponentArray = new ComponentArray<TombstoneComponent>();
export const ZombieComponentArray = new ComponentArray<ZombieComponent>();
export const SlimewispComponentArray = new ComponentArray<SlimewispComponent>();
export const SlimeComponentArray = new ComponentArray<SlimeComponent>();
export const ArrowComponentArray = new ComponentArray<ArrowComponent>();
export const YetiComponentArray = new ComponentArray<YetiComponent>();
export const SnowballComponentArray = new ComponentArray<SnowballComponent>();
export const FishComponentArray = new ComponentArray<FishComponent>();
export const FrozenYetiComponentArray = new ComponentArray<FrozenYetiComponent>();
export const RockSpikeProjectileComponentArray = new ComponentArray<RockSpikeProjectileComponent>();
export const CookingEntityComponentArray = new ComponentArray<CookingEntityComponent>();