// Function Plane — Ball physics tuning
//
// energyRetention: fraction of total speed kept after each *real bounce*
//   (significant normal-velocity impact; sliding contact does NOT trigger it,
//   so a ball rolling along a slope keeps its tangential momentum).
//   1.0 = no energy loss on bounce
//   0.0 = instant full stop on first impact
//
// bounciness: coefficient of restitution for the surface-normal velocity
//   component, applied on every contact (slide or bounce).
//   0.0 = no bounce (ball settles onto curve)
//   1.0 = perfectly elastic bounce
//   Values above ~0.4 make most levels very hard to solve.
//
// traction: how quickly contact bleeds speed *along* a surface, per second of
//   contact. Drag is proportional to speed, so a ball on a slope settles at
//   gravity*sin(angle)/traction rather than grinding to a halt — it keeps
//   gliding forever, just not accelerating forever. It only comes to rest
//   where the surface is flat enough that gravity has no tangential pull.
//   0   = frictionless ice (the old behaviour)
//   0.6 = terminal speed ~14 units/s down a 45 degree slope
//   1.2 = terminal ~7 units/s; reads as sluggish, slopes feel like mud
//   4+  = most momentum puzzles stop working
//
//   Keep this low enough that a slope still feels like falling. The drag is
//   linear in speed, so terminal speed scales as 1/traction: doubling this
//   number halves how fast anything ever rolls.

const PHYSICS_CONFIG = {
  energyRetention: 0.985,
  bounciness:      0.5,
  traction:        0.6,
};

window.PHYSICS_CONFIG = PHYSICS_CONFIG;
