class QueryBuilder {
    constructor() {
        this.reset();
    }

    reset() {
        this.type = '';
        this.table = '';
        this.fields = [];
        this.conditions = [];
        this.params = [];
        this.groups = [];
        this.orders = [];
        this.limitValue = null;
        this.offsetValue = null;
        return this;
    }

    select(fields = ['*']) {
        this.type = 'SELECT';
        this.fields = Array.isArray(fields) ? fields : [fields];
        return this;
    }

    insert(table) {
        this.type = 'INSERT';
        this.table = table;
        return this;
    }

    update(table) {
        this.type = 'UPDATE';
        this.table = table;
        return this;
    }

    delete(table) {
        this.type = 'DELETE';
        this.table = table;
        return this;
    }

    from(table) {
        this.table = table;
        return this;
    }

    where(condition, ...params) {
        this.conditions.push(condition);
        this.params.push(...params);
        return this;
    }

    groupBy(fields) {
        this.groups = Array.isArray(fields) ? fields : [fields];
        return this;
    }

    orderBy(field, direction = 'ASC') {
        this.orders.push({ field, direction: direction.toUpperCase() });
        return this;
    }

    limit(value) {
        this.limitValue = value;
        return this;
    }

    offset(value) {
        this.offsetValue = value;
        return this;
    }

    build() {
        switch (this.type) {
            case 'SELECT':
                return this.buildSelect();
            case 'INSERT':
                return this.buildInsert();
            case 'UPDATE':
                return this.buildUpdate();
            case 'DELETE':
                return this.buildDelete();
            default:
                throw new Error('Query type not specified');
        }
    }

    buildSelect() {
        let query = `SELECT ${this.fields.join(', ')} FROM ${this.table}`;

        if (this.conditions.length) {
            query += ` WHERE ${this.conditions.join(' AND ')}`;
        }

        if (this.groups.length) {
            query += ` GROUP BY ${this.groups.join(', ')}`;
        }

        if (this.orders.length) {
            query += ` ORDER BY ${this.orders.map(o => `${o.field} ${o.direction}`).join(', ')}`;
        }

        if (this.limitValue !== null) {
            query += ` LIMIT ?`;
            this.params.push(this.limitValue);
        }

        if (this.offsetValue !== null) {
            query += ` OFFSET ?`;
            this.params.push(this.offsetValue);
        }

        return {
            sql: query,
            params: this.params
        };
    }

    buildInsert() {
        const { fields, values } = this.extractFieldsAndValues();
        const query = `INSERT INTO ${this.table} (${fields.join(', ')}) VALUES ?`;
        return {
            sql: query,
            params: [values]
        };
    }

    buildUpdate() {
        const setClause = this.fields.map(field => `${field} = ?`).join(', ');
        let query = `UPDATE ${this.table} SET ${setClause}`;

        if (this.conditions.length) {
            query += ` WHERE ${this.conditions.join(' AND ')}`;
        }

        return {
            sql: query,
            params: this.params
        };
    }

    buildDelete() {
        let query = `DELETE FROM ${this.table}`;

        if (this.conditions.length) {
            query += ` WHERE ${this.conditions.join(' AND ')}`;
        }

        return {
            sql: query,
            params: this.params
        };
    }

    extractFieldsAndValues() {
        if (!this.fields.length || !this.params.length) {
            throw new Error('No fields or values specified for insert');
        }

        return {
            fields: this.fields,
            values: this.params
        };
    }
}

module.exports = QueryBuilder;