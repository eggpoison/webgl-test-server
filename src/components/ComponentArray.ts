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
import { IceShardComponent } from "./IceShardComponent";
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
import { CookingComponent } from "./CookingEntityComponent";
import { ThrowingProjectileComponent } from "./ThrowingProjectileComponent";
import { HutComponent } from "./HutComponent";
import { SlimeSpitComponent } from "./SlimeSpitComponent";
import { DoorComponent } from "./DoorComponent";
import { GolemComponent } from "./GolemComponent";
import { IceSpikesComponent } from "./IceSpikesComponent";
import { PebblumComponent } from "./PebblumComponent";
import { PhysicsComponent } from "./PhysicsComponent";
import { BlueprintComponent } from "./BlueprintComponent";
import { TurretComponent } from "./TurretComponent";
import { BallistaComponent } from "./BallistaComponent";

export class ComponentArray<T extends {} = {}> {
   public components = new Array<T>();
   public componentBuffer = new Array<T>();
   
   /** Maps entity IDs to component indexes */
   private entityToIndexMap: Record<number, number> = {};
   /** Maps component indexes to entity IDs */
   private indexToEntityMap: Record<number, number> = {};

   private componentBufferIDs = new Array<number>();
   
   public addComponent(entity: Entity, component: T): void {
      if (this.entityToIndexMap.hasOwnProperty(entity.id)) {
         throw new Error("Component added to same entity twice.");
      }

      this.componentBuffer.push(component);
      this.componentBufferIDs.push(entity.id);
   }

   public pushComponentFromBuffer(): void {
      const component = this.componentBuffer[0];
      const entityID = this.componentBufferIDs[0];
      
      // Put new entry at end and update the maps
      const newIndex = this.components.length;
      this.entityToIndexMap[entityID] = newIndex;
      this.indexToEntityMap[newIndex] = entityID;
      this.components.push(component);

      this.componentBuffer.splice(0, 1);
      this.componentBufferIDs.splice(0, 1);
   }

   public getComponent(entity: Entity): T {
      return this.components[this.entityToIndexMap[entity.id]];
   }

   // Much slower than the regular getComponent array, and only able to be done when the entity hasn't been added to the board yet
   public getComponentFromBuffer(entity: Entity): T {
      for (let i = 0; i < this.componentBuffer.length; i++) {
         const entityID = this.componentBufferIDs[i];
         if (entityID === entity.id) {
            return this.componentBuffer[i];
         }
      }
      throw new Error("Component wasn't in buffer");
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
export const CookingEntityComponentArray = new ComponentArray<CookingComponent>();
export const ThrowingProjectileComponentArray = new ComponentArray<ThrowingProjectileComponent>();
export const HutComponentArray = new ComponentArray<HutComponent>();
export const SlimeSpitComponentArray = new ComponentArray<SlimeSpitComponent>();
export const DoorComponentArray = new ComponentArray<DoorComponent>();
export const GolemComponentArray = new ComponentArray<GolemComponent>();
export const IceSpikesComponentArray = new ComponentArray<IceSpikesComponent>();
export const PebblumComponentArray = new ComponentArray<PebblumComponent>();
export const PhysicsComponentArray = new ComponentArray<PhysicsComponent>();
export const BlueprintComponentArray = new ComponentArray<BlueprintComponent>();
export const TurretComponentArray = new ComponentArray<TurretComponent>();
export const BallistaComponentArray = new ComponentArray<BallistaComponent>();