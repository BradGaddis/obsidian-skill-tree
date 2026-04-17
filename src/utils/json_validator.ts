/**
 * JSON schema validation for imported skill trees.
 * Validates that imported tree data conforms to expected structure.
 */

interface ValidationError {
    field: string;
    message: string;
}

interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validates a SkillTreeData object against expected schema.
 * @param data - The imported tree data to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateSkillTreeData(data: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    // Check if data is an object
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: [{ field: 'root', message: 'Invalid input: expected an object' }] };
    }

    const treeData = data as Record<string, unknown>;

    // Validate required top-level fields
    if (typeof treeData.name !== 'string' || treeData.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Missing or invalid required field: name (must be a non-empty string)' });
    } else if (treeData.name.length > 100) {
        errors.push({ field: 'name', message: 'Field too long: name (max 100 characters)' });
    }

    // Validate nodes array
    if (!Array.isArray(treeData.nodes)) {
        errors.push({ field: 'nodes', message: 'Missing or invalid required field: nodes (must be an array)' });
    } else {
        const nodeErrors = validateNodesArray(treeData.nodes);
        errors.push(...nodeErrors);
    }

    // Validate edges array
    if (!Array.isArray(treeData.edges)) {
        errors.push({ field: 'edges', message: 'Missing or invalid required field: edges (must be an array)' });
    } else {
        const edgeErrors = validateEdgesArray(treeData.edges);
        errors.push(...edgeErrors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates the nodes array of a skill tree.
 */
function validateNodesArray(nodes: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(nodes)) {
        return [{ field: 'nodes', message: 'nodes must be an array' }];
    }

    // Limit max number of nodes to prevent DoS
    if (nodes.length > 10000) {
        errors.push({ field: 'nodes', message: 'Too many nodes (max 10000)' });
        return errors;
    }

    nodes.forEach((node, index) => {
        if (!node || typeof node !== 'object') {
            errors.push({ field: `nodes[${index}]`, message: 'Node must be an object' });
            return;
        }

        const nodeData = node as Record<string, unknown>;

        // Validate required fields
        if (typeof nodeData.x !== 'number' || !Number.isFinite(nodeData.x)) {
            errors.push({ field: `nodes[${index}].x`, message: 'Invalid x coordinate (must be a number)' });
        }
        if (typeof nodeData.y !== 'number' || !Number.isFinite(nodeData.y)) {
            errors.push({ field: `nodes[${index}].y`, message: 'Invalid y coordinate (must be a number)' });
        }
        if (typeof nodeData.nodeTypeName !== 'string' || nodeData.nodeTypeName.trim().length === 0) {
            errors.push({ field: `nodes[${index}].nodeTypeName`, message: 'Invalid node type (must be a non-empty string)' });
        }

        // Validate optional fields if present
        if (nodeData.state !== undefined) {
            const validStates = ['complete', 'inProgress', 'onHold', 'unavailable', 'error'];
            if (!validStates.includes(nodeData.state as string)) {
                errors.push({ field: `nodes[${index}].state`, message: `Invalid state: ${nodeData.state}` });
            }
        }

        if (nodeData.shape !== undefined) {
            const validShapes = ['circle', 'square', 'hexagon', 'diamond', 'repeat'];
            if (!validShapes.includes(nodeData.shape as string)) {
                errors.push({ field: `nodes[${index}].shape`, message: `Invalid shape: ${nodeData.shape}` });
            }
        }

        if (nodeData.exp !== undefined) {
            if (typeof nodeData.exp !== 'number' || nodeData.exp < 0) {
                errors.push({ field: `nodes[${index}].exp`, message: 'Invalid exp (must be a non-negative number)' });
            }
        }

        // Validate fileLink if present (should be a valid path string)
        if (nodeData.fileLink !== undefined) {
            if (typeof nodeData.fileLink !== 'string') {
                errors.push({ field: `nodes[${index}].fileLink`, message: 'Invalid fileLink (must be a string)' });
            }
        }

        // Validate displayText if present
        if (nodeData.displayText !== undefined) {
            if (typeof nodeData.displayText !== 'string') {
                errors.push({ field: `nodes[${index}].displayText`, message: 'Invalid displayText (must be a string)' });
            } else if (nodeData.displayText.length > 500) {
                errors.push({ field: `nodes[${index}].displayText`, message: 'displayText too long (max 500 characters)' });
            }
        }
    });

    return errors;
}

/**
 * Validates the edges array of a skill tree.
 */
function validateEdgesArray(edges: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(edges)) {
        return [{ field: 'edges', message: 'edges must be an array' }];
    }

    // Limit max number of edges to prevent DoS
    if (edges.length > 20000) {
        errors.push({ field: 'edges', message: 'Too many edges (max 20000)' });
        return errors;
    }

    edges.forEach((edge, index) => {
        if (!edge || typeof edge !== 'object') {
            errors.push({ field: `edges[${index}]`, message: 'Edge must be an object' });
            return;
        }

        const edgeData = edge as Record<string, unknown>;

        // Validate id
        if (typeof edgeData.id !== 'number' && typeof edgeData.id !== 'string') {
            errors.push({ field: `edges[${index}].id`, message: 'Invalid edge id' });
        }

        // Validate from/to (can be null, number, or string)
        if (edgeData.from !== undefined && edgeData.from !== null &&
            typeof edgeData.from !== 'number' && typeof edgeData.from !== 'string') {
            errors.push({ field: `edges[${index}].from`, message: 'Invalid from field' });
        }
        if (edgeData.to !== undefined && edgeData.to !== null &&
            typeof edgeData.to !== 'number' && typeof edgeData.to !== 'string') {
            errors.push({ field: `edges[${index}].to`, message: 'Invalid to field' });
        }

        // Validate fromSide/toSide if present
        if (edgeData.fromSide !== undefined) {
            const validSides = ['top', 'right', 'bottom', 'left'];
            if (!validSides.includes(edgeData.fromSide as string)) {
                errors.push({ field: `edges[${index}].fromSide`, message: `Invalid fromSide: ${edgeData.fromSide}` });
            }
        }
        if (edgeData.toSide !== undefined) {
            const validSides = ['top', 'right', 'bottom', 'left'];
            if (!validSides.includes(edgeData.toSide as string)) {
                errors.push({ field: `edges[${index}].toSide`, message: `Invalid toSide: ${edgeData.toSide}` });
            }
        }

        // Validate coordinate fields if present
        if (edgeData.fromX !== undefined && (typeof edgeData.fromX !== 'number' || !Number.isFinite(edgeData.fromX))) {
            errors.push({ field: `edges[${index}].fromX`, message: 'Invalid fromX coordinate' });
        }
        if (edgeData.fromY !== undefined && (typeof edgeData.fromY !== 'number' || !Number.isFinite(edgeData.fromY))) {
            errors.push({ field: `edges[${index}].fromY`, message: 'Invalid fromY coordinate' });
        }
        if (edgeData.toX !== undefined && (typeof edgeData.toX !== 'number' || !Number.isFinite(edgeData.toX))) {
            errors.push({ field: `edges[${index}].toX`, message: 'Invalid toX coordinate' });
        }
        if (edgeData.toY !== undefined && (typeof edgeData.toY !== 'number' || !Number.isFinite(edgeData.toY))) {
            errors.push({ field: `edges[${index}].toY`, message: 'Invalid toY coordinate' });
        }
    });

    return errors;
}

/**
 * Formats validation errors into a user-friendly message.
 * @param errors - Array of validation errors
 * @returns Formatted error message string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
    if (errors.length === 0) return 'Unknown error';
    const messages = errors.map(e => `- ${e.field}: ${e.message}`);
    return `Validation failed:\n${messages.join('\n')}`;
}