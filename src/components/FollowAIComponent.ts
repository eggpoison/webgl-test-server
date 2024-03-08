import { FollowAIComponentData, SettingsConst } from "webgl-test-shared";
import Board from "../Board";
import Entity, { ID_SENTINEL_VALUE } from "../Entity";
import { moveEntityToPosition } from "../ai-shared";
import { FollowAIComponentArray } from "./ComponentArray";

export class FollowAIComponent {
   /** ID of the followed entity */
   public followTargetID = ID_SENTINEL_VALUE;
   public followCooldownTicks: number;
   /** Keeps track of how long the mob has been interested in its target */
   public interestTimer = 0;

   constructor(followCooldownTicks: number) {
      this.followCooldownTicks = followCooldownTicks;
   }
}

export function updateFollowAIComponent(entity: Entity, visibleEntities: ReadonlyArray<Entity>, interestDuration: number): void {
   const followAIComponent = FollowAIComponentArray.getComponent(entity.id);
   if (followAIComponent.followTargetID !== ID_SENTINEL_VALUE) {
      if (followAIComponent.followCooldownTicks > 0) {
         followAIComponent.followCooldownTicks--;
      }
      
      // Make sure the follow target is still within the vision range
      const followTarget = Board.entityRecord[followAIComponent.followTargetID];
      if (!visibleEntities.includes(followTarget)) {
         followAIComponent.followTargetID = ID_SENTINEL_VALUE;
         followAIComponent.interestTimer = 0;
         return;
      }
      
      followAIComponent.interestTimer += SettingsConst.I_TPS;
      if (followAIComponent.interestTimer >= interestDuration) {
         followAIComponent.followTargetID = ID_SENTINEL_VALUE;
      }
   }
}

export function followEntity(entity: Entity, followedEntity: Entity, acceleration: number, newFollowCooldownTicks: number): void {
   const followAIComponent = FollowAIComponentArray.getComponent(entity.id);
   followAIComponent.followTargetID = followedEntity.id;
   followAIComponent.followCooldownTicks = newFollowCooldownTicks;
   followAIComponent.interestTimer = 0;
   moveEntityToPosition(entity, followedEntity.position.x, followedEntity.position.y, acceleration);
};

export function canFollow(followAIComponent: FollowAIComponent): boolean {
   return followAIComponent.followCooldownTicks === 0;
}

export function serialiseFollowAIComponent(entity: Entity): FollowAIComponentData {
   const followAIComponent = FollowAIComponentArray.getComponent(entity.id);
   return {
      followTargetID: followAIComponent.followTargetID,
      followCooldownTicks: followAIComponent.followCooldownTicks,
      interestTimer: followAIComponent.interestTimer
   };
}