package com.eazycount.dto;

import java.util.List;
import java.util.Map;

/**
 * One batch of a keyset-paged list. {@code nextCursor} is null on the last batch; {@code total} is only
 * counted on the first batch (no cursor) and null afterwards.
 */
public record CursorPage<T>(List<T> rows, Map<String, Object> nextCursor, Long total) {
}
