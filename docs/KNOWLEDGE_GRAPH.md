# Agricultural Knowledge Graph

## Purpose

The Agricultural Knowledge Graph links operational reality, canonical agricultural entities, scientific concepts, expert knowledge, derived insights, and network intelligence. It is the reasoning and explainability layer of Bananos Inteligentes.

## Graph Principles

- The graph is policy-aware and multi-tenant.
- Raw tenant facts and Bananos-owned concepts are separated by ownership and visibility.
- Every edge should have provenance, confidence, and temporal context.
- Graph retrieval must be filtered before AI use.
- The graph should support both tenant-specific reasoning and network-level learning.

## Graph Partitions

### Tenant Subgraphs

Tenant subgraphs include client-owned canonical entities and events:

- Farms.
- Blocks.
- Crop cycles.
- Observations.
- Tasks.
- Inputs.
- Harvests.
- Quality outcomes.
- Costs.
- Equipment.
- Labor events.

### Shared Agronomic Concept Graph

The shared concept graph includes Bananos-owned and public knowledge:

- Crop stages.
- Pest and disease concepts.
- Nutrient relationships.
- Soil properties.
- Weather risks.
- Management practices.
- Regulatory concepts.
- Scientific findings.
- Expert playbooks.

### Insights Graph

The insights graph links intelligence artifacts to evidence, subjects, concepts, recommendations, and outcomes.

### Network Intelligence Projection

Network projections expose only privacy-preserving aggregated relationships and artifacts.

## Major Node Types

- Tenant.
- Organization.
- Farm.
- Field.
- Block.
- Plot.
- CropCycle.
- Cultivar.
- PlantingEvent.
- PhenologyStage.
- SoilSample.
- TissueSample.
- WeatherObservation.
- IrrigationEvent.
- FertilizationEvent.
- ChemicalApplication.
- ScoutingObservation.
- Pest.
- Disease.
- Weed.
- Symptom.
- InputProduct.
- Equipment.
- LaborActivity.
- HarvestEvent.
- PackoutResult.
- QualityGrade.
- CostRecord.
- SalesRecord.
- Certification.
- Insight.
- Recommendation.
- Forecast.
- Benchmark.
- Playbook.
- AgronomicConcept.
- ResearchReference.
- Model.
- PromptTemplate.
- Memory.
- Conversation.
- ConsentPolicy.

## Major Edge Types

- `OWNS`
- `OPERATES`
- `CONTAINS`
- `LOCATED_IN`
- `HAS_CROP_CYCLE`
- `USES_CULTIVAR`
- `OBSERVED_AT`
- `AFFECTS`
- `CAUSES`
- `CORRELATES_WITH`
- `MITIGATED_BY`
- `RECOMMENDS`
- `EVIDENCED_BY`
- `DERIVED_FROM`
- `GENERATED_BY`
- `SIMILAR_TO`
- `PRECEDES`
- `FOLLOWS`
- `HAS_OUTCOME`
- `HAS_RISK`
- `HAS_CONFIDENCE`
- `GOVERNED_BY`
- `CONSENTED_FOR`
- `CITES`

## Temporal Model

Agriculture is temporal. Nodes and edges should support:

- Valid time.
- Transaction time.
- Crop-cycle context.
- Seasonal context.
- Observation time.
- Event duration.
- Supersession.

Graph queries must be able to distinguish what was true historically from what is true now.

## Spatial Model

The graph should support:

- Farm and block boundaries.
- Coordinates.
- Geospatial hierarchy.
- Adjacency.
- Distance.
- Regional grouping.
- Weather and soil overlays.
- Disease pressure zones.

Spatial relationships should be stored in geospatial-capable systems and linked into the graph.

## Provenance Model

Every node and edge should include:

- Source.
- Ownership.
- Visibility scope.
- Lineage.
- Confidence.
- Created time.
- Updated time.
- Evidence reference.
- Policy metadata.

## Reasoning Use Cases

- Explain why a block is at elevated disease risk.
- Find similar historical crop cycles.
- Connect symptoms to possible diseases and recommended observations.
- Trace recommendation evidence from raw observations to insight artifacts.
- Identify which insights are affected by a corrected source record.
- Discover regional patterns without exposing tenant records.
- Support graph-grounded Banana Chat answers.
- Detect contradictions between data sources, expert rules, and model outputs.

## Graph and Canonical Model Relationship

The canonical model is the source of operational facts. The graph is the relationship and reasoning projection.

Canonical data should not be replaced by graph storage. Instead:

- Canonical warehouse stores normalized facts and analytics.
- Graph store links facts, concepts, insights, and evidence.
- Search and vector stores support retrieval over graph descriptions and insight text.

## Graph Construction

Graph construction sources:

- Canonical entity upserts.
- Canonical event streams.
- Insights Repository publications.
- Expert-authored knowledge.
- Public research ingestion.
- AI-assisted extraction subject to review.
- Network intelligence artifacts.

Graph updates should be event-driven and idempotent.

## AI-Assisted Graph Expansion

AI can propose:

- Concept relationships.
- Similarity links.
- Causal hypotheses.
- Entity normalization suggestions.
- Research-to-concept mappings.

AI-proposed graph changes require confidence scores and review workflows before becoming authoritative.

## Query and Retrieval

Graph retrieval modes:

- Entity neighborhood.
- Path explanation.
- Similar case retrieval.
- Concept expansion.
- Impact analysis.
- Policy-filtered subgraph projection.
- Temporal graph query.
- Spatial graph query.

Banana Chat should receive compact, policy-filtered graph context rather than unrestricted graph dumps.

## Privacy and Tenant Isolation

Tenant subgraphs must be isolated. Cross-tenant reasoning may operate only through approved network projections or anonymized aggregates. Graph queries must never traverse from one tenant's raw operational node to another tenant's raw operational node unless an explicit authorized relationship exists.

## Recommended Graph Stack

Production options:

- Neo4j for property graph querying and explainable path traversal.
- PostgreSQL with Apache AGE for tighter operational integration.
- Neptune if operating heavily in AWS.

The final selection should consider query complexity, managed availability, cost, geospatial integration, and team expertise.
