import Tribe from "../Tribe";

export class TribeComponent {
   tribe: Tribe | null;

   constructor(tribe: Tribe | null) {
      this.tribe = tribe;
   }
}