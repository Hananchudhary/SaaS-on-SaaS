

const ErrorCodes = {
    // Validation Errors (400)
    MISSING_FIELDS: {
        code: 400,
        message: 'Email and password are required'
    },
    
    // Authentication Errors (401)
    INVALID_CREDENTIALS: {
        code: 401,
        message: 'Invalid email or password'
    },
    USER_INACTIVE: {
        code: 402,
        message: 'Your account is inactive. Please contact administrator'
    },
    CLIENT_INACTIVE: {
        code: 403,
        message: 'Your company account is suspended. Please contact support'
    },
    USER_ALREADY_ACTICE: {
        code: 404,
        message: 'User is already log in somewhere'
    },
    
    LOGIN_FAILED: {
        code: 501,
        message: 'Login failed due to server error'
    },
    SESSION_CREATION_FAILED: {
        code: 502,
        message: 'Failed to create user session'
    },

    SESSION_NOT_FOUND: {
        code: 503,
        message: 'Session ID Required'
    },
    LOGOUT_FAILED: {
        code: 504,
        message: 'Logout failed due to server error'
    },

    UNKNOWN_ERROR:{
        code: 900,
        message: 'An unknown error occured'
    },
    INTERNAL_ERROR:{
        code: 800,
        message: 'An internal error occured. Please try again later'
    },
    INVALID_PLAN_ID: {
        code: 406,
        message: 'Invalid plan ID selected'
    },
    CHECK_CONSTRAINT_VIOLATION: {
        code: 407,
        message: 'Data violates business rule constraints'
    },

    // Conflict Errors (409)
    EMAIL_ALREADY_EXISTS: {
        code: 409,
        message: 'Email already exists'
    },
    USERNAME_ALREADY_EXISTS: {
        code: 410,  // 409 is taken, using 410
        message: 'Username already exists'
    },
    SERIALIZATION_FAILURE: {
        code: 411,
        message: 'Concurrent signup detected. Please try again.'
    },
    CLIENT_ALREADY_EXISTS: {
        code: 412,
        message: 'Email already exists'
    },
    EDITOR_ACCESS_DISABLED: {
        code: 601,
        message: 'Editor access is disabled due to overdue invoices'
    },
    QUERY_NOT_ALLOWED: {
        code: 602,
        message: 'This type of query is not allowed'
    },
    CREATE_ALTER_DROP_NOT_ALLOWED: {
        code: 603,
        message: 'CREATE, ALTER, and DROP operations are not allowed'
    },
    TIER2_OPERATION_DENIED: {
        code: 605,
        message: 'Tier 2 users are not allowed to perform INSERT or DELETE operations'
    },
    TIER3_OPERATION_DENIED: {
        code: 606,
        message: 'Tier 3 users are only allowed to SELECT operations'
    },
    CROSS_TENANT_ACCESS_DENIED: {
        code: 607,
        message: 'Access Denied'
    },
    INVALID_QUERY: {
        code: 608,
        message: 'Invalid SQL query'
    },
    QUERY_EXECUTION_FAILED: {
        code: 610,
        message: 'Query execution failed'
    },
    NO_ACTIVE_SUBSCRIPTION: {
        code: 701,
        message: 'No active subscription found for this company'
    },
    INVOICE_CREATION_FAILED: {
        code: 702,
        message: 'Failed to create invoice'
    },
    PAYMENT_PROCESSING_FAILED: {
        code: 703,
        message: 'Failed to process payment'
    },
    TRANSACTION_FAILED: {
        code: 704,
        message: 'Payment transaction failed'
    },
    INVOICE_ALREADY_EXISTS: {
        code: 705,
        message: 'Invoice for this period already exists'
    }
};


const createErrorResponse = (errorCode, details = null) => {
    const response = {
        success: false,
        error: {
            code: errorCode.code,
            message: errorCode.message
        }
    };
    
    if (details) {
        response.error.details = details;
    }
    
    return response;
};

module.exports = {
    ErrorCodes,
    createErrorResponse
};