import { FrozenYetiAttackType, Point } from "webgl-test-shared";
import { FROZEN_YETI_STOMP_COOLDOWN, FrozenYetiRockSpikeInfo, FrozenYetiTargetInfo } from "../entities/mobs/frozen-yeti";

export class FrozenYetiComponent {
   public readonly attackingEntities: Record<number, FrozenYetiTargetInfo> = {};

   public attackType = FrozenYetiAttackType.none;
   public attackStage = 0;
   public stageProgress = 0;

   public globalAttackCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;
   public snowballThrowCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;
   public roarCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;
   public biteCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;
   public stompCooldownTimer = FROZEN_YETI_STOMP_COOLDOWN;

   public lastTargetPosition: Point | null = null;

   public targetPosition: Point | null = null;

   public rockSpikeInfoArray = new Array<FrozenYetiRockSpikeInfo>();
}