# Step-by-Step Integration Plan - TWC → ETH

## Problem Analysis

**Current Error**: "No route found after 3 attempts... We tried LiFi and the enhanced routing system, but none of them support this swap."

**Root Cause Analysis**:
1. ✅ RouteService fallback is working (it's calling enhanced system)
2. ❌ Graph is likely empty (no pairs loaded)
3. ❌ Pathfinder can't find routes without graph data
4. ❓ Route conversion might have issues

## Step-by-Step Plan

### Phase 1: Graph Population & Verification
**Goal**: Ensure graph has data before pathfinding

**Steps**:
1. Add diagnostic logging to check graph state
2. Manually populate graph for BSC (where TWC is)
3. Verify graph has pairs
4. Test graph queries

**Success Criteria**: Graph has > 0 edges for BSC chain

---

### Phase 2: Pathfinding Test
**Goal**: Verify pathfinder can find routes with populated graph

**Steps**:
1. Test pathfinding with known pairs (TWC → WBNB)
2. Test multi-hop pathfinding (TWC → WBNB → WETH)
3. Add detailed logging at each step
4. Verify route structure

**Success Criteria**: Pathfinder returns valid routes

---

### Phase 3: Route Conversion Test
**Goal**: Ensure UniversalRoute converts to RouterRoute correctly

**Steps**:
1. Test route conversion
2. Verify RouterRoute format matches executor expectations
3. Test with frontend

**Success Criteria**: Route can be displayed and executed

---

### Phase 4: End-to-End Integration
**Goal**: Full flow from RouteService → Execution

**Steps**:
1. Test full flow with logging
2. Verify error handling
3. Test execution

**Success Criteria**: TWC → ETH swap works end-to-end

---

## Implementation Strategy

**Approach**: Add comprehensive logging at each step, test incrementally, fix issues as we find them.

**No rushing**: Each phase must pass before moving to next.

