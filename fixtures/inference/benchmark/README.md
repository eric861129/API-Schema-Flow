# M2-C Inference Benchmark

This synthetic benchmark fixes the expected mappings before the inference quality report is evaluated.

It covers:

- create-resource response IDs mapped to item-read path IDs;
- login tokens mapped only to explicitly bearer-secured Authorization targets;
- generic cross-resource ID false positives;
- array values that require an explicit selector;
- secret-shaped values targeting non-security inputs;
- suppression of mappings already declared by OpenAPI Links.

The fixtures contain no production schemas or runtime credential values. Labels must not be changed merely to match generated output; rule changes require an explanation in the pull request and verification report.
